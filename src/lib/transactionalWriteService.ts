import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export const globalEventBus = new EventEmitter();

export type EntityName = 'students' | 'teachers' | 'classes' | 'enrollments' | 'users' | 'roles_permissions';
export type MutationOp = 'CREATE' | 'UPDATE' | 'DELETE';

export interface WriteRequest {
  entity: EntityName;
  entityId: string; // UUID string
  op: MutationOp;
  expectedVersion: number;
  payload: Record<string, any>;
  actorId: string; // User UUID string
  actorRole: 'ADMIN' | 'STAFF' | 'STUDENT';
  actorScope?: string;
  idempotencyKey: string;
  ipAddress: string;
  requestId: string;
}

export interface WriteResult {
  success: boolean;
  code: number;
  newVersion?: number;
  seq?: number;
  error?: string;
  currentServerState?: Record<string, any>;
}

export class TransactionalWriteService {
  constructor(private pool: mysql.Pool) {}

  /**
   * Executes atomic mutation with composite idempotency locking, global sequence row lock,
   * optimistic version check, and change_log + audit_log recording within a single transaction.
   */
  async executeWrite(req: WriteRequest): Promise<WriteResult> {
    const conn = await this.pool.getConnection();

    try {
      await conn.beginTransaction();

      const actorIdBin = Buffer.from(req.actorId.replace(/-/g, ''), 'hex');
      const requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ entity: req.entity, entityId: req.entityId, op: req.op, payload: req.payload }))
        .digest('hex');

      // 1. Lock Composite Idempotency Key (user_id, idempotency_key)
      const [idempotentRows]: any = await conn.execute(
        `SELECT request_hash, status, response_code, response_body 
         FROM idempotency_keys 
         WHERE user_id = ? AND idempotency_key = ? FOR UPDATE`,
        [actorIdBin, req.idempotencyKey]
      );

      if (idempotentRows.length > 0) {
        const existing = idempotentRows[0];

        // Mismatched request hash -> 422 Unprocessable Entity
        if (existing.request_hash !== requestHash) {
          await conn.rollback();
          return {
            success: false,
            code: 422,
            error: 'تناقض محتوای درخواست با کلید شناسه تک‌باره قبلی (422 Unprocessable Entity).'
          };
        }

        // Processing state -> 409 Conflict
        if (existing.status === 'PROCESSING') {
          await conn.rollback();
          return {
            success: false,
            code: 409,
            error: 'درخواست قبلی با همین کلید شناسه همچنان در حال پردازش توسط سرور است.'
          };
        }

        // Completed state -> Replay cached response body
        if (existing.status === 'COMPLETED') {
          await conn.commit();
          const cachedBody = typeof existing.response_body === 'string'
            ? JSON.parse(existing.response_body)
            : existing.response_body;
          return {
            success: existing.response_code === 200,
            code: existing.response_code,
            ...cachedBody
          };
        }
      } else {
        const expiresAt = new Date(Date.now() + 86400000); // 24 hours retention
        await conn.execute(
          `INSERT INTO idempotency_keys (user_id, idempotency_key, request_hash, status, response_code, response_body, expires_at, created_at)
           VALUES (?, ?, ?, 'PROCESSING', 0, '{}', ?, NOW(3))`,
          [actorIdBin, req.idempotencyKey, requestHash, expiresAt]
        );
      }

      // 2. Lock Global Sequence Counter (SELECT ... FOR UPDATE)
      const [seqRows]: any = await conn.execute(
        `SELECT current_val FROM sequence_counter WHERE id = 1 FOR UPDATE`
      );
      if (!seqRows || seqRows.length === 0) {
        throw new Error('Sequence counter row missing in sequence_counter table');
      }

      const currentSeq = BigInt(seqRows[0].current_val) + 1n;
      await conn.execute(
        `UPDATE sequence_counter SET current_val = ? WHERE id = 1`,
        [currentSeq.toString()]
      );

      // 3. Perform Business Table Mutation with Optimistic Version Locking
      const entityIdBin = Buffer.from(req.entityId.replace(/-/g, ''), 'hex');
      let newVersion = req.expectedVersion + 1;
      let oldServerValues: Record<string, any> | null = null;

      if (req.op === 'CREATE') {
        const fields = ['id', 'version', 'created_at', 'updated_at', 'updated_by'];
        const valuesPlaceholder = ['?', '?', 'NOW(3)', 'NOW(3)', '?'];
        const params: any[] = [entityIdBin, 1, actorIdBin];

        Object.keys(req.payload).forEach((key) => {
          fields.push(`\`${key}\``);
          valuesPlaceholder.push('?');
          params.push(req.payload[key]);
        });

        const sql = `INSERT INTO \`${req.entity}\` (${fields.join(',')}) VALUES (${valuesPlaceholder.join(',')})`;
        await conn.execute(sql, params);
        newVersion = 1;

      } else if (req.op === 'UPDATE') {
        const [currentRows]: any = await conn.execute(
          `SELECT * FROM \`${req.entity}\` WHERE id = ? AND deleted_at IS NULL`,
          [entityIdBin]
        );

        if (currentRows.length === 0) {
          await conn.rollback();
          return { success: false, code: 404, error: 'رکورد مورد نظر یافت نشد.' };
        }

        oldServerValues = currentRows[0];
        if (oldServerValues.version !== req.expectedVersion) {
          await conn.rollback();
          return {
            success: false,
            code: 409,
            error: 'تداخل نسخه همزمانی (Conflict). رکورد توسط کاربر دیگری تغییر یافته است.',
            currentServerState: oldServerValues
          };
        }

        const setClauses: string[] = ['version = ?', 'updated_at = NOW(3)', 'updated_by = ?'];
        const updateParams: any[] = [newVersion, actorIdBin];

        Object.keys(req.payload).forEach((key) => {
          setClauses.push(`\`${key}\` = ?`);
          updateParams.push(req.payload[key]);
        });

        updateParams.push(entityIdBin, req.expectedVersion);
        const updateSql = `UPDATE \`${req.entity}\` SET ${setClauses.join(', ')} WHERE id = ? AND version = ? AND deleted_at IS NULL`;
        const [updateRes]: any = await conn.execute(updateSql, updateParams);

        if (updateRes.affectedRows === 0) {
          await conn.rollback();
          return {
            success: false,
            code: 409,
            error: 'تداخل همزمانی در ثبت داده.',
            currentServerState: oldServerValues
          };
        }

      } else if (req.op === 'DELETE') {
        const [currentRows]: any = await conn.execute(
          `SELECT * FROM \`${req.entity}\` WHERE id = ? AND deleted_at IS NULL`,
          [entityIdBin]
        );

        if (currentRows.length === 0) {
          await conn.rollback();
          return { success: false, code: 404, error: 'رکورد یافت نشد یا قبلاً حذف شده است.' };
        }

        oldServerValues = currentRows[0];
        if (oldServerValues.version !== req.expectedVersion) {
          await conn.rollback();
          return {
            success: false,
            code: 409,
            error: 'تداخل نسخه همزمانی در حذف رکورد.',
            currentServerState: oldServerValues
          };
        }

        const deleteSql = `UPDATE \`${req.entity}\` SET deleted_at = NOW(3), version = ?, updated_by = ? WHERE id = ? AND version = ?`;
        await conn.execute(deleteSql, [newVersion, actorIdBin, entityIdBin, req.expectedVersion]);
      }

      // 4. Record Sequence-Ordered Event in change_log
      await conn.execute(
        `INSERT INTO change_log (seq, entity, entity_id, op, payload_delta, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [currentSeq.toString(), req.entity, entityIdBin, req.op, JSON.stringify(req.payload), actorIdBin]
      );

      // 5. Record Masked Immutable Log in audit_log
      const beforeMasked = oldServerValues ? maskSensitiveAuditFields(oldServerValues) : null;
      const afterMasked = maskSensitiveAuditFields(req.payload);

      await conn.execute(
        `INSERT INTO audit_log (actor_id, action, entity, entity_id, ip_address, request_id, before_values, after_values, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          actorIdBin,
          `${req.entity.toUpperCase()}_${req.op}`,
          req.entity,
          entityIdBin,
          req.ipAddress,
          req.requestId,
          beforeMasked ? JSON.stringify(beforeMasked) : null,
          afterMasked ? JSON.stringify(afterMasked) : null
        ]
      );

      // 6. Complete Idempotency Record
      const responsePayload = { newVersion, seq: Number(currentSeq) };
      await conn.execute(
        `UPDATE idempotency_keys 
         SET status = 'COMPLETED', response_code = 200, response_body = ? 
         WHERE user_id = ? AND idempotency_key = ?`,
        [JSON.stringify(responsePayload), actorIdBin, req.idempotencyKey]
      );

      await conn.commit();

      // Emit to Fastify event bus post-commit
      globalEventBus.emit('change_event', {
        seq: Number(currentSeq),
        entity: req.entity,
        entityId: req.entityId,
        op: req.op,
        payload: req.payload,
        actorId: req.actorId,
        actorRole: req.actorRole,
        actorScope: req.actorScope
      });

      return {
        success: true,
        code: 200,
        newVersion,
        seq: Number(currentSeq)
      };

    } catch (err: any) {
      await conn.rollback();
      return {
        success: false,
        code: 500,
        error: err.message || 'خطای داخلی سرور Fastify در ثبت تراکنش.'
      };
    } finally {
      conn.release();
    }
  }
}

function maskSensitiveAuditFields(obj: Record<string, any>): Record<string, any> {
  const masked = { ...obj };
  if (masked.national_id_enc) masked.national_id_enc = '[MASKED_NATIONAL_ID]';
  if (masked.phone_enc) masked.phone_enc = '[MASKED_PHONE]';
  if (masked.password_hash) masked.password_hash = '[MASKED_PASSWORD]';
  return masked;
}

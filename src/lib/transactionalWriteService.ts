import mysql from 'mysql2/promise';
import { EventEmitter } from 'events';

export const globalEventBus = new EventEmitter();

export interface WriteRequest {
  entity: string; // 'students', 'teachers', 'classes', 'enrollments', 'attendance', 'lunch_reservations', 'student_requests', 'reports', 'study_logs', 'users'
  entityId: string; // UUID string
  op: 'CREATE' | 'UPDATE' | 'DELETE';
  expectedVersion: number;
  payload: Record<string, any>;
  actorId: string;
  actorRole: string;
  idempotencyKey: string;
  ipAddress: string;
}

export interface WriteResult {
  success: boolean;
  code: number;
  newVersion?: number;
  seq?: number;
  error?: string;
  currentServerState?: any;
}

export class TransactionalWriteService {
  constructor(private pool: mysql.Pool) {}

  /**
   * Execute atomic mutation with sequence lock, optimistic lock, change_log, and audit_log
   */
  async executeWrite(req: WriteRequest): Promise<WriteResult> {
    const conn = await this.pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Check Idempotency Key
      const [idempotentRows]: any = await conn.execute(
        `SELECT response_code, response_body FROM idempotency_keys WHERE idempotency_key = ?`,
        [req.idempotencyKey]
      );

      if (idempotentRows.length > 0) {
        await conn.commit();
        const cached = idempotentRows[0];
        return {
          success: cached.response_code === 200,
          code: cached.response_code,
          ...cached.response_body
        };
      }

      // 2. Lock Sequence Counter for Commit-Ordering (SELECT ... FOR UPDATE)
      const [seqRows]: any = await conn.execute(
        `SELECT current_val FROM sequence_counter WHERE id = 1 FOR UPDATE`
      );
      const currentSeq = BigInt(seqRows[0].current_val) + 1n;

      await conn.execute(
        `UPDATE sequence_counter SET current_val = ? WHERE id = 1`,
        [currentSeq.toString()]
      );

      // 3. Perform Business Entity Write & Optimistic Lock Check
      const entityIdBin = Buffer.from(req.entityId.replace(/-/g, ''), 'hex');
      const actorIdBin = Buffer.from(req.actorId.replace(/-/g, ''), 'hex');

      let newVersion = req.expectedVersion + 1;
      let oldServerValues: any = null;

      if (req.op === 'CREATE') {
        // Create insertion
        const fields = ['id', 'version', 'created_at', 'updated_at', 'updated_by'];
        const valuesPlaceholder = ['?', '?', 'NOW(3)', 'NOW(3)', '?'];
        const params: any[] = [entityIdBin, 1, actorIdBin];

        Object.keys(req.payload).forEach((key) => {
          fields.push(key);
          valuesPlaceholder.push('?');
          params.push(req.payload[key]);
        });

        const sql = `INSERT INTO \`${req.entity}\` (${fields.join(',')}) VALUES (${valuesPlaceholder.join(',')})`;
        await conn.execute(sql, params);
        newVersion = 1;

      } else if (req.op === 'UPDATE') {
        // Read current state for optimistic check & audit
        const [currentRows]: any = await conn.execute(
          `SELECT * FROM \`${req.entity}\` WHERE id = ? AND deleted_at IS NULL`,
          [entityIdBin]
        );

        if (currentRows.length === 0) {
          await conn.rollback();
          return {
            success: false,
            code: 404,
            error: 'رکورد مورد نظر یافت نشد.'
          };
        }

        oldServerValues = currentRows[0];
        const serverVersion = oldServerValues.version;

        if (serverVersion !== req.expectedVersion) {
          await conn.rollback();
          return {
            success: false,
            code: 409,
            error: 'تداخل در ثبت اطلاعات. رکورد توسط کاربر دیگری تغییر یافته است.',
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
            error: 'تداخل همزمانی در بروزرسانی رکورد.',
            currentServerState: oldServerValues
          };
        }

      } else if (req.op === 'DELETE') {
        // Soft Delete (Tombstone)
        const [currentRows]: any = await conn.execute(
          `SELECT * FROM \`${req.entity}\` WHERE id = ? AND deleted_at IS NULL`,
          [entityIdBin]
        );

        if (currentRows.length === 0) {
          await conn.rollback();
          return { success: false, code: 404, error: 'رکورد مورد نظر قبلاً حذف شده است.' };
        }

        oldServerValues = currentRows[0];
        const serverVersion = oldServerValues.version;

        if (serverVersion !== req.expectedVersion) {
          await conn.rollback();
          return {
            success: false,
            code: 409,
            error: 'تداخل در حذف. نسخه رکورد متفاوت است.',
            currentServerState: oldServerValues
          };
        }

        const deleteSql = `UPDATE \`${req.entity}\` SET deleted_at = NOW(3), version = ?, updated_by = ? WHERE id = ? AND version = ?`;
        const [delRes]: any = await conn.execute(deleteSql, [newVersion, actorIdBin, entityIdBin, req.expectedVersion]);

        if (delRes.affectedRows === 0) {
          await conn.rollback();
          return { success: false, code: 409, error: 'خطا در حذف رکورد.' };
        }
      }

      // 4. Append to change_log
      await conn.execute(
        `INSERT INTO change_log (seq, entity, entity_id, op, payload_delta, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          currentSeq.toString(),
          req.entity,
          entityIdBin,
          req.op,
          JSON.stringify(req.payload),
          actorIdBin
        ]
      );

      // 5. Append to audit_log
      await conn.execute(
        `INSERT INTO audit_log (actor_id, action, entity, entity_id, ip_address, old_values, new_values, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          actorIdBin,
          `${req.entity.toUpperCase()}_${req.op}`,
          req.entity,
          entityIdBin,
          req.ipAddress,
          oldServerValues ? JSON.stringify(oldServerValues) : null,
          JSON.stringify(req.payload)
        ]
      );

      // 6. Save Idempotency Key Response
      const responsePayload = { newVersion, seq: Number(currentSeq) };
      await conn.execute(
        `INSERT INTO idempotency_keys (idempotency_key, user_id, request_hash, response_code, response_body, created_at)
         VALUES (?, ?, ?, 200, ?, NOW(3))`,
        [req.idempotencyKey, actorIdBin, 'hash_placeholder', JSON.stringify(responsePayload)]
      );

      // Commit transaction
      await conn.commit();

      const result: WriteResult = {
        success: true,
        code: 200,
        newVersion,
        seq: Number(currentSeq)
      };

      // 7. Emit Event to In-Memory Event Bus after successful DB commit
      globalEventBus.emit('change_event', {
        seq: Number(currentSeq),
        entity: req.entity,
        entityId: req.entityId,
        op: req.op,
        payload: req.payload,
        actorId: req.actorId,
        actorRole: req.actorRole
      });

      return result;

    } catch (err: any) {
      await conn.rollback();
      return {
        success: false,
        code: 500,
        error: err.message || 'خطای داخلی سرور در ثبت تراکنش.'
      };
    } finally {
      conn.release();
    }
  }
}

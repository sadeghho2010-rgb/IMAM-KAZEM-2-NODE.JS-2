import { Router, Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { verifyAccessToken } from '../lib/serverAuth';

export function createSyncRouter(pool: mysql.Pool): Router {
  const router = Router();

  /**
   * GET /api/v1/sync
   * Cursor-based delta synchronization endpoint with Tombstone support.
   * 
   * Query Parameters:
   * - cursor: string | number (Sequence number to stream changes after)
   * - limit: number (Max changes per page, default 100, max 500)
   * - entity: string (Optional filter by entity)
   */
  router.get('/v1/sync', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.cookies?.auth_token;
      
      if (!token) {
        return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
      }

      const verification = verifyAccessToken(token);
      if (!verification.valid || !verification.decoded) {
        return res.status(401).json({ success: false, message: 'توکن غیرمعتبر است.' });
      }

      const callerUser = verification.decoded;
      const cursor = req.query.cursor ? BigInt(String(req.query.cursor)) : 0n;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10), 1), 500);
      const entityFilter = req.query.entity ? String(req.query.entity) : null;

      let sql = `
        SELECT 
          seq, 
          entity, 
          HEX(entity_id) as entity_id_hex, 
          op, 
          payload_delta, 
          actor_id, 
          created_at 
        FROM change_log 
        WHERE seq > ?
      `;
      const params: any[] = [cursor.toString()];

      if (entityFilter) {
        sql += ` AND entity = ?`;
        params.push(entityFilter);
      }

      sql += ` ORDER BY seq ASC LIMIT ?`;
      params.push(limit);

      const [rows]: any = await pool.execute(sql, params);

      const items = rows.map((row: any) => {
        const isTombstone = row.op === 'DELETE';
        const payload = typeof row.payload_delta === 'string' 
          ? JSON.parse(row.payload_delta) 
          : row.payload_delta;

        return {
          seq: Number(row.seq),
          entity: row.entity,
          entityId: row.entity_id_hex,
          op: row.op,
          isTombstone,
          payload: isTombstone ? { id: row.entity_id_hex, deleted: true } : payload,
          createdAt: row.created_at
        };
      });

      // RBAC Scope Filtering
      const filteredItems = items.filter((item: any) => {
        if (callerUser.role === 'ADMIN') return true;
        if (callerUser.role === 'STUDENT') {
          if (item.entity === 'students' && item.entityId !== callerUser.userId) return false;
        }
        return true;
      });

      const nextCursor = items.length > 0 ? items[items.length - 1].seq : cursor;
      const hasMore = items.length === limit;

      return res.status(200).json({
        success: true,
        data: {
          items: filteredItems,
          pagination: {
            cursor: nextCursor.toString(),
            hasMore,
            limit
          }
        }
      });

    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'خطا در دریافت تغییرات دلتا'
      });
    }
  });

  return router;
}

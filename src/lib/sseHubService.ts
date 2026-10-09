import { Response } from 'express';
import mysql from 'mysql2/promise';
import { globalEventBus } from './transactionalWriteService';

export interface SseSubscriber {
  id: string;
  userId: string;
  role: string;
  scope: string;
  res: Response;
  lastEventSeq: number;
}

export class SseHubService {
  private subscribers: Map<string, SseSubscriber> = new Map();
  private userConnectionCount: Map<string, number> = new Map();

  constructor(private pool: mysql.Pool) {
    // Listen to in-process change events published after DB transaction commit
    globalEventBus.on('change_event', (event) => {
      this.broadcastEvent(event);
    });

    // 20-second Heartbeat timer
    setInterval(() => {
      this.sendHeartbeat();
    }, 20000);
  }

  /**
   * Register a new SSE subscriber with connection limit enforcement
   */
  async registerClient(
    subId: string,
    userId: string,
    role: string,
    scope: string,
    lastEventId: number,
    res: Response
  ): Promise<boolean> {
    const currentCount = this.userConnectionCount.get(userId) || 0;
    if (currentCount >= 2) {
      res.status(429).json({ error: 'حداکثر تعداد اتصالات همزمان SSE برقرار است.' });
      return false;
    }

    // Set HTTP-Only SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    const subscriber: SseSubscriber = {
      id: subId,
      userId,
      role,
      scope,
      res,
      lastEventSeq: lastEventId
    };

    this.subscribers.set(subId, subscriber);
    this.userConnectionCount.set(userId, currentCount + 1);

    // Replay missed events from change_log if client sent Last-Event-ID
    if (lastEventId > 0) {
      await this.replayMissedEvents(subscriber, lastEventId);
    }

    // Handle client disconnect
    res.on('close', () => {
      this.subscribers.delete(subId);
      const count = this.userConnectionCount.get(userId) || 1;
      if (count <= 1) {
        this.userConnectionCount.delete(userId);
      } else {
        this.userConnectionCount.set(userId, count - 1);
      }
    });

    return true;
  }

  /**
   * Replay change_log records with seq > lastEventId
   */
  private async replayMissedEvents(sub: SseSubscriber, sinceSeq: number) {
    try {
      const [rows]: any = await this.pool.execute(
        `SELECT seq, entity, entity_id, op, payload_delta, actor_id, created_at 
         FROM change_log 
         WHERE seq > ? 
         ORDER BY seq ASC 
         LIMIT 200`,
        [sinceSeq]
      );

      for (const row of rows) {
        const payload = typeof row.payload_delta === 'string' ? JSON.parse(row.payload_delta) : row.payload_delta;
        const event = {
          seq: Number(row.seq),
          entity: row.entity,
          entityId: row.entity_id.toString('hex'),
          op: row.op,
          payload
        };

        if (this.canUserReceiveEvent(sub, event)) {
          this.writeSseEvent(sub.res, event.seq, event);
        }
      }
    } catch (err) {
      console.error('[SSE Replay Error]', err);
    }
  }

  /**
   * Broadcast change event to active subscribers based on RBAC & Scope filters
   */
  private broadcastEvent(event: any) {
    for (const sub of this.subscribers.values()) {
      if (this.canUserReceiveEvent(sub, event)) {
        this.writeSseEvent(sub.res, event.seq, event);
      }
    }
  }

  /**
   * Scope & Role authorization filter
   */
  private canUserReceiveEvent(sub: SseSubscriber, event: any): boolean {
    if (sub.role === 'ADMIN') return true;

    // Student scope restriction
    if (sub.role === 'STUDENT') {
      // Students only receive events where entityId matches their own student/user ID or public entity
      if (event.entity === 'students' && event.payload?.userId !== sub.userId && event.entityId !== sub.userId) {
        return false;
      }
      if (event.entity === 'attendance' && event.payload?.studentId !== sub.userId) return false;
      if (event.entity === 'lunch_reservations' && event.payload?.userId !== sub.userId) return false;
      if (event.entity === 'study_logs' && event.payload?.studentId !== sub.userId) return false;
    }

    // Staff department scope check
    if (sub.role === 'STAFF' && sub.scope !== 'ALL') {
      if (event.payload?.department && event.payload.department !== sub.scope) {
        return false;
      }
    }

    return true;
  }

  private writeSseEvent(res: Response, id: number, data: any) {
    res.write(`id: ${id}\n`);
    res.write(`event: mutation\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private sendHeartbeat() {
    for (const sub of this.subscribers.values()) {
      sub.res.write(`: heartbeat ${Date.now()}\n\n`);
    }
  }
}

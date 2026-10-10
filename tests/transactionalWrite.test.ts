import { describe, it, expect, beforeEach, vi } from 'vitest';
import mysql from 'mysql2/promise';
import { TransactionalWriteService, WriteRequest } from '../src/lib/transactionalWriteService';

describe('TransactionalWriteService Integration & Atomic Execution Tests', () => {
  let mockConnection: any;
  let mockPool: any;
  let service: TransactionalWriteService;
  let executedQueries: { sql: string; params?: any[] }[] = [];

  beforeEach(() => {
    executedQueries = [];
    
    // Create a mock connection that simulates MySQL transaction steps
    mockConnection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockReturnValue(undefined),
      execute: vi.fn(async (sql: string, params?: any[]) => {
        executedQueries.push({ sql, params });

        // 1. SELECT FOR UPDATE on idempotency_keys
        if (sql.includes('FROM idempotency_keys')) {
          return [[]]; // No prior idempotent request found
        }

        // 2. INSERT into idempotency_keys
        if (sql.includes('INSERT INTO idempotency_keys')) {
          return [{ affectedRows: 1 }];
        }

        // 3. SELECT FOR UPDATE on sequence_counter
        if (sql.includes('FROM sequence_counter')) {
          return [[{ current_val: '100' }]];
        }

        // 4. UPDATE sequence_counter
        if (sql.includes('UPDATE sequence_counter')) {
          return [{ affectedRows: 1 }];
        }

        // 5. INSERT into entity table
        if (sql.startsWith('INSERT INTO `students`')) {
          return [{ affectedRows: 1 }];
        }

        // 6. SELECT current record for UPDATE/DELETE
        if (sql.includes('FROM `students` WHERE id = ?')) {
          // If params match existing test record version 1
          return [[{
            id: Buffer.from('018f26a2e63f70008000000000000001', 'hex'),
            version: 1,
            first_name: 'علی',
            last_name: 'محمدی'
          }]];
        }

        // 7. UPDATE entity with optimistic version lock
        if (sql.startsWith('UPDATE `students`')) {
          const expectedVer = params ? params[params.length - 1] : 1;
          if (expectedVer === 1) {
            return [{ affectedRows: 1 }];
          } else {
            return [{ affectedRows: 0 }]; // Concurrency Conflict
          }
        }

        // 8. INSERT change_log
        if (sql.includes('INSERT INTO change_log')) {
          return [{ affectedRows: 1 }];
        }

        // 9. INSERT audit_log
        if (sql.includes('INSERT INTO audit_log')) {
          return [{ affectedRows: 1 }];
        }

        // 10. UPDATE idempotency_keys
        if (sql.includes('UPDATE idempotency_keys')) {
          return [{ affectedRows: 1 }];
        }

        return [[]];
      })
    };

    mockPool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection)
    } as unknown as mysql.Pool;

    service = new TransactionalWriteService(mockPool);
  });

  it('1. Executes atomic write transaction (business row + change_log + audit_log commit together)', async () => {
    const req: WriteRequest = {
      entity: 'students',
      entityId: '018f26a2-e63f-7000-8000-000000000001',
      op: 'CREATE',
      expectedVersion: 0,
      payload: { first_name: 'رضا', last_name: 'اکبری', status: 'ACTIVE' },
      actorId: '018f26a2-e63f-7000-8000-000000000099',
      actorRole: 'ADMIN',
      idempotencyKey: 'idem-key-atomic-1',
      ipAddress: '192.168.1.10',
      requestId: 'req-atomic-100'
    };

    const res = await service.executeWrite(req);

    expect(res.success).toBe(true);
    expect(res.code).toBe(200);
    expect(res.seq).toBe(101);
    expect(res.newVersion).toBe(1);

    // Verify transaction lifecycle
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).not.toHaveBeenCalled();

    // Verify SQL statements sequence
    const sqls = executedQueries.map(q => q.sql);
    expect(sqls.some(s => s.includes('idempotency_keys'))).toBe(true);
    expect(sqls.some(s => s.includes('sequence_counter'))).toBe(true);
    expect(sqls.some(s => s.startsWith('INSERT INTO `students`'))).toBe(true);
    expect(sqls.some(s => s.includes('INSERT INTO change_log'))).toBe(true);
    expect(sqls.some(s => s.includes('INSERT INTO audit_log'))).toBe(true);
  });

  it('2. Enforces idempotency key to prevent duplicate creation and replays completed responses', async () => {
    // Override execute mock to return completed idempotency row
    mockConnection.execute = vi.fn(async (sql: string) => {
      if (sql.includes('FROM idempotency_keys')) {
        return [[{
          request_hash: '1a2b3c4d5e6f78901a2b3c4d5e6f78901a2b3c4d5e6f78901a2b3c4d5e6f7890',
          status: 'COMPLETED',
          response_code: 200,
          response_body: JSON.stringify({ newVersion: 1, seq: 101 })
        }]];
      }
      return [[]];
    });

    // Mock requestHash to match
    const req: WriteRequest = {
      entity: 'students',
      entityId: '018f26a2-e63f-7000-8000-000000000001',
      op: 'CREATE',
      expectedVersion: 0,
      payload: { first_name: 'رضا', last_name: 'اکبری', status: 'ACTIVE' },
      actorId: '018f26a2-e63f-7000-8000-000000000099',
      actorRole: 'ADMIN',
      idempotencyKey: 'idem-key-duplicate-2',
      ipAddress: '192.168.1.10',
      requestId: 'req-dup-101'
    };

    // Replace SHA256 hash calc match
    vi.spyOn(require('crypto'), 'createHash').mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('1a2b3c4d5e6f78901a2b3c4d5e6f78901a2b3c4d5e6f78901a2b3c4d5e6f7890')
    } as any);

    const res = await service.executeWrite(req);

    expect(res.success).toBe(true);
    expect(res.code).toBe(200);
    expect(res.seq).toBe(101);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
  });

  it('3. Rejects update on version conflict with 409 status', async () => {
    const req: WriteRequest = {
      entity: 'students',
      entityId: '018f26a2-e63f-7000-8000-000000000001',
      op: 'UPDATE',
      expectedVersion: 99, // Mismatched version (Server has 1)
      payload: { first_name: 'علی‌رضا' },
      actorId: '018f26a2-e63f-7000-8000-000000000099',
      actorRole: 'STAFF',
      idempotencyKey: 'idem-key-conflict-3',
      ipAddress: '192.168.1.10',
      requestId: 'req-conflict-102'
    };

    const res = await service.executeWrite(req);

    expect(res.success).toBe(false);
    expect(res.code).toBe(409);
    expect(res.error).toContain('تداخل نسخه همزمانی');
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
  });

  it('4. Performs soft delete with deleted_at timestamp and version bump', async () => {
    const req: WriteRequest = {
      entity: 'students',
      entityId: '018f26a2-e63f-7000-8000-000000000001',
      op: 'DELETE',
      expectedVersion: 1, // Matches current DB record version
      payload: {},
      actorId: '018f26a2-e63f-7000-8000-000000000099',
      actorRole: 'ADMIN',
      idempotencyKey: 'idem-key-delete-4',
      ipAddress: '192.168.1.10',
      requestId: 'req-del-103'
    };

    const res = await service.executeWrite(req);

    expect(res.success).toBe(true);
    expect(res.code).toBe(200);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);

    const deleteSql = executedQueries.find(q => q.sql.includes('deleted_at = NOW(3)'));
    expect(deleteSql).toBeDefined();
  });
});

import Dexie, { Table } from 'dexie';

export interface PendingMutation {
  idempotencyKey: string;
  entity: string;
  entityId: string;
  op: 'CREATE' | 'UPDATE' | 'DELETE';
  expectedVersion: number;
  payload: Record<string, any>;
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount: number;
}

export interface CachedEntity {
  id: string;
  version: number;
  updatedAt: string;
  isPendingLocal?: boolean;
  [key: string]: any;
}

export class SeminaryLocalDatabase extends Dexie {
  students!: Table<CachedEntity, string>;
  teachers!: Table<CachedEntity, string>;
  classes!: Table<CachedEntity, string>;
  enrollments!: Table<CachedEntity, string>;
  users!: Table<CachedEntity, string>;
  roles_permissions!: Table<CachedEntity, string>;
  mutation_queue!: Table<PendingMutation, string>;
  sync_metadata!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('SeminaryLocalDatabase');

    this.version(2).stores({
      students: 'id, version, level, department, status, updatedAt',
      teachers: 'id, version, status, updatedAt',
      classes: 'id, version, teacher_id, academic_year, updatedAt',
      enrollments: 'id, version, student_id, class_id, status',
      users: 'id, version, username, role',
      roles_permissions: 'id, version, role_name, resource',
      mutation_queue: 'idempotencyKey, entity, entityId, timestamp, status',
      sync_metadata: 'key'
    });
  }

  async clearAllLocalCaches() {
    await this.transaction('rw', this.tables, async () => {
      for (const table of this.tables) {
        await table.clear();
      }
    });
  }
}

export const localDb = new SeminaryLocalDatabase();

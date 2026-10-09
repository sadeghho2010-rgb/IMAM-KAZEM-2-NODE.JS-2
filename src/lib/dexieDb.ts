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
  attendance!: Table<CachedEntity, string>;
  lunch_reservations!: Table<CachedEntity, string>;
  student_requests!: Table<CachedEntity, string>;
  reports!: Table<CachedEntity, string>;
  study_logs!: Table<CachedEntity, string>;
  users!: Table<CachedEntity, string>;
  mutation_queue!: Table<PendingMutation, string>;
  sync_metadata!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('SeminaryLocalDatabase');

    this.version(1).stores({
      students: 'id, version, level, department, status, updatedAt',
      teachers: 'id, version, status, updatedAt',
      classes: 'id, version, teacher_id, academic_year, updatedAt',
      enrollments: 'id, version, student_id, class_id, status',
      attendance: 'id, version, class_id, student_id, session_date',
      lunch_reservations: 'id, version, user_id, reservation_date',
      student_requests: 'id, version, student_id, status',
      reports: 'id, version, author_id, report_type',
      study_logs: 'id, version, student_id, study_date',
      users: 'id, version, username, role',
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

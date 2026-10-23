import type { AuditDetails, AuditEntry, AuditRepo } from '../ports.js';
import type { Sql } from './pg.js';

interface Row {
  id: string;
  staff_id: string | null;
  action: string;
  learner_id: string | null;
  details: AuditDetails;
  at: Date;
}

export class PgAuditRepo implements AuditRepo {
  constructor(private readonly sql: Sql) {}

  async add(entry: Omit<AuditEntry, 'id' | 'at'>): Promise<void> {
    await this.sql`
      insert into audit_log (staff_id, action, learner_id, details)
      values (${entry.staffId}, ${entry.action}, ${entry.learnerId}, ${this.sql.json(entry.details)})`;
  }

  async page(before: number | null, limit: number): Promise<AuditEntry[]> {
    const rows = await this.sql<Row[]>`
      select id::text, staff_id, action, learner_id, details, at from audit_log
      where ${before === null} or id < ${before ?? 0}
      order by audit_log.id desc limit ${limit}`;
    return rows.map((r) => ({
      id: Number(r.id),
      staffId: r.staff_id,
      action: r.action,
      learnerId: r.learner_id,
      details: r.details,
      at: r.at.toISOString(),
    }));
  }

  async anonymiseLearner(learnerId: string): Promise<void> {
    await this.sql`
      update audit_log
      set learner_id = null, details = details || '{"learner": "DELETED"}'::jsonb
      where learner_id = ${learnerId}`;
  }
}

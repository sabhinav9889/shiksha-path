import type { SwitchRepo } from '../ports.js';
import type { Sql } from './pg.js';

const asRecord = (rows: { key: string; enabled: boolean }[]): Record<string, boolean> =>
  Object.fromEntries(rows.map((r) => [r.key, r.enabled]));

export class PgSwitchRepo implements SwitchRepo {
  constructor(private readonly sql: Sql) {}

  async allStudents(): Promise<Record<string, boolean>> {
    return asRecord(
      await this.sql<{ key: string; enabled: boolean }[]>`
        select key, enabled_for_all as enabled from feature_switches`,
    );
  }

  async overrides(learnerId: string): Promise<Record<string, boolean>> {
    return asRecord(
      await this.sql<{ key: string; enabled: boolean }[]>`
        select key, enabled from feature_overrides where learner_id = ${learnerId}`,
    );
  }
}

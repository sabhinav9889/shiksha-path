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

  async setForAll(key: string, enabled: boolean): Promise<void> {
    await this.sql`update feature_switches set enabled_for_all = ${enabled} where key = ${key}`;
  }

  async setOverride(learnerId: string, key: string, enabled: boolean | null): Promise<void> {
    if (enabled === null) {
      await this
        .sql`delete from feature_overrides where learner_id = ${learnerId} and key = ${key}`;
      return;
    }
    await this.sql`
      insert into feature_overrides (learner_id, key, enabled) values (${learnerId}, ${key}, ${enabled})
      on conflict (learner_id, key) do update set enabled = excluded.enabled`;
  }
}

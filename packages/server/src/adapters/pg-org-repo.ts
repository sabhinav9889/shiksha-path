import type { OrgRepo } from '../ports.js';
import type { Sql } from './pg.js';

export class PgOrgRepo implements OrgRepo {
  constructor(private readonly sql: Sql) {}

  async saveLab(lab: { id?: string; name: string }): Promise<string> {
    const [row] = await this.sql<{ id: string }[]>`
      insert into labs (id, name) values (coalesce(${lab.id ?? null}::uuid, gen_random_uuid()),
                                          ${lab.name})
      on conflict (id) do update set name = excluded.name
      returning id`;
    return row?.id ?? '';
  }

  async saveCohort(c: { id?: string; name: string; labId: string | null }): Promise<string> {
    const [row] = await this.sql<{ id: string }[]>`
      insert into cohorts (id, name, lab_id)
      values (coalesce(${c.id ?? null}::uuid, gen_random_uuid()), ${c.name}, ${c.labId})
      on conflict (id) do update set name = excluded.name, lab_id = excluded.lab_id
      returning id`;
    return row?.id ?? '';
  }

  async setLearnerCohort(learnerId: string, cohortId: string | null): Promise<void> {
    await this.sql`update learners set cohort_id = ${cohortId} where id = ${learnerId}`;
  }

  /** The learner's cohort, null for none, undefined when there is no such learner. */
  async cohortOfLearner(learnerId: string): Promise<string | null | undefined> {
    const rows = await this.sql<{ cohort_id: string | null }[]>`
      select cohort_id from learners where id = ${learnerId}`;
    return rows.length === 0 ? undefined : (rows[0]?.cohort_id ?? null);
  }

  async cohorts(
    ids: string[] | 'all',
  ): Promise<{ id: string; name: string; labId: string | null }[]> {
    const rows = await this.sql<{ id: string; name: string; lab_id: string | null }[]>`
      select id, name, lab_id from cohorts
      where ${ids === 'all'} or id in
        (select value::uuid from jsonb_array_elements_text(${this.sql.json(ids === 'all' ? [] : ids)}))
      order by name`;
    return rows.map((r) => ({ id: r.id, name: r.name, labId: r.lab_id }));
  }
}

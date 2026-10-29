import type { DeleteResult, OrgRepo, StudentRow } from '../ports.js';

interface Row {
  id: string;
  name: string;
  cohort_id: string | null;
  deactivated: boolean;
  linked_on: string;
  last_synced: Date | null;
}

const toStudent = (r: Row): StudentRow => ({
  id: r.id,
  name: r.name,
  cohortId: r.cohort_id,
  deactivated: r.deactivated,
  linkedOn: r.linked_on,
  lastSyncedAt: r.last_synced?.toISOString() ?? null,
});
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

  /**
   * The row is locked first, in the same transaction. A learner being moved in holds a share lock
   * on it, so we wait for that move to commit and the check then sees it. Without the lock the
   * check would use a snapshot from before the move, and the delete would silently detach them.
   */
  async deleteLab(id: string): Promise<DeleteResult> {
    return this.sql.begin(async (tx) => {
      const [lab] = await tx`select id from labs where id = ${id} for update`;
      if (!lab) return 'missing';
      const gone = await tx`
        delete from labs l where l.id = ${id}
          and not exists (select 1 from cohorts c where c.lab_id = l.id)
        returning l.id`;
      return gone.length > 0 ? 'deleted' : 'not_empty';
    });
  }

  async deleteCohort(id: string): Promise<DeleteResult> {
    return this.sql.begin(async (tx) => {
      const [cohort] = await tx`select id from cohorts where id = ${id} for update`;
      if (!cohort) return 'missing';
      const gone = await tx`
        delete from cohorts c where c.id = ${id}
          and not exists (select 1 from learners l where l.cohort_id = c.id)
        returning c.id`;
      return gone.length > 0 ? 'deleted' : 'not_empty';
    });
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

  private select(where: 'all' | 'cohorts' | 'one', value: string[] | string) {
    const list = this.sql.json(Array.isArray(value) ? value : [value]);
    return this.sql<Row[]>`
      select l.id, l.name, l.cohort_id, l.deactivated_at is not null as deactivated,
             to_char(l.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as linked_on,
             (select max(e.received_at) from learner_events e where e.learner_id = l.id)
               as last_synced
      from learners l
      where ${where} = 'all'
         or (${where} = 'cohorts' and l.cohort_id in
               (select value::uuid from jsonb_array_elements_text(${list})))
         or (${where} = 'one' and l.id in
               (select value::uuid from jsonb_array_elements_text(${list})))
      order by l.name`;
  }

  async students(cohortIds: string[] | 'all'): Promise<StudentRow[]> {
    const rows = await (cohortIds === 'all'
      ? this.select('all', [])
      : this.select('cohorts', cohortIds));
    return rows.map(toStudent);
  }

  async student(learnerId: string): Promise<StudentRow | null> {
    const [row] = await this.select('one', learnerId);
    return row ? toStudent(row) : null;
  }

  async labs(): Promise<{ id: string; name: string }[]> {
    return [
      ...(await this.sql<{ id: string; name: string }[]>`select id, name from labs order by name`),
    ];
  }

  async setDeactivated(learnerId: string, deactivated: boolean): Promise<void> {
    await this.sql`
      update learners set deactivated_at = case when ${deactivated} then now() else null end
      where id = ${learnerId}`;
  }

  async renameLearner(learnerId: string, name: string): Promise<void> {
    await this.sql`update learners set name = ${name} where id = ${learnerId}`;
  }

  /** `q` is matched as literal text: % and _ in it are escaped, never wildcards. */
  async search(filter: {
    q?: string;
    cohortIds?: string[];
    active?: boolean;
    after?: string;
    limit: number;
  }): Promise<StudentRow[]> {
    const escaped = (filter.q ?? '').replace(/[\\%_]/g, (c) => '\\' + c);
    const pattern = '%'.concat(escaped, '%'); // a bound parameter, never part of the SQL text
    const cohorts = this.sql.json(filter.cohortIds ?? []);
    const rows = await this.sql<Row[]>`
      select l.id, l.name, l.cohort_id, l.deactivated_at is not null as deactivated,
             to_char(l.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as linked_on,
             (select max(e.received_at) from learner_events e where e.learner_id = l.id)
               as last_synced
      from learners l
      where l.name ilike ${pattern}
        and (${filter.cohortIds === undefined} or l.cohort_id in
              (select value::uuid from jsonb_array_elements_text(${cohorts})))
        and (${filter.active === undefined} or (l.deactivated_at is null) = ${filter.active ?? true})
        and (${filter.after === undefined} or (l.name, l.id) >
              (select a.name, a.id from learners a where a.id = ${filter.after ?? null}::uuid))
      order by l.name, l.id
      limit ${filter.limit}`;
    return rows.map(toStudent);
  }
}

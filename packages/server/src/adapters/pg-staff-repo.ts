import type { StaffRepo, StaffRole, StaffRow } from '../ports.js';
import type { Sql } from './pg.js';

interface Row {
  id: string;
  email: string;
  role: StaffRole;
  name: string;
  active: boolean;
  auth_user_id: string | null;
  cohort_ids: string[] | null;
}

const toRow = (r: Row): StaffRow => ({
  id: r.id,
  email: r.email,
  role: r.role,
  name: r.name,
  active: r.active,
  authUserId: r.auth_user_id,
  cohortIds: (r.cohort_ids ?? []).filter(Boolean).sort(),
});

export class PgStaffRepo implements StaffRepo {
  constructor(private readonly sql: Sql) {}

  private async one(where: 'id' | 'auth' | 'email', value: string): Promise<StaffRow | null> {
    const rows = await this.sql<Row[]>`
      select s.*, array_agg(sc.cohort_id) filter (where sc.cohort_id is not null) as cohort_ids
      from staff s left join staff_cohorts sc on sc.staff_id = s.id
      where (${where} = 'id' and s.id::text = ${value})
         or (${where} = 'auth' and s.auth_user_id::text = ${value})
         or (${where} = 'email' and lower(s.email) = lower(${value}))
      group by s.id`;
    return rows[0] ? toRow(rows[0]) : null;
  }

  byId(id: string): Promise<StaffRow | null> {
    return this.one('id', id);
  }

  byAuthUser(authUserId: string): Promise<StaffRow | null> {
    return this.one('auth', authUserId);
  }

  byEmail(email: string): Promise<StaffRow | null> {
    return this.one('email', email);
  }

  async claim(staffId: string, authUserId: string): Promise<boolean> {
    const done = await this.sql`
      update staff set auth_user_id = ${authUserId}
      where id = ${staffId} and auth_user_id is null and active
      returning id`;
    return done.length === 1;
  }

  async save(row: Omit<StaffRow, 'id' | 'authUserId'> & { id?: string }): Promise<string> {
    return this.sql.begin(async (tx) => {
      const [saved] = await tx<{ id: string }[]>`
        insert into staff (id, email, role, name, active)
        values (coalesce(${row.id ?? null}::uuid, gen_random_uuid()), ${row.email}, ${row.role},
                ${row.name}, ${row.active})
        on conflict (id) do update
          set email = excluded.email, role = excluded.role, name = excluded.name,
              active = excluded.active
        returning id`;
      const id = saved?.id ?? '';
      await tx`delete from staff_cohorts where staff_id = ${id}`;
      for (const cohortId of row.cohortIds) {
        await tx`insert into staff_cohorts (staff_id, cohort_id) values (${id}, ${cohortId})`;
      }
      return id;
    });
  }

  async list(): Promise<StaffRow[]> {
    const rows = await this.sql<Row[]>`
      select s.*, array_agg(sc.cohort_id) filter (where sc.cohort_id is not null) as cohort_ids
      from staff s left join staff_cohorts sc on sc.staff_id = s.id
      group by s.id order by s.name`;
    return rows.map(toRow);
  }

  /**
   * Cohort links go with the row; audit and review references are set to null. The last active
   * admin is never removed: the admin rows are locked first, so two admins deleting each other
   * at the same moment take turns and the second is refused.
   */
  async delete(staffId: string): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      await tx`select id from staff where role = 'admin' for update`;
      const gone = await tx`
        delete from staff s where s.id = ${staffId}
          and (s.role <> 'admin' or exists (
            select 1 from staff o where o.role = 'admin' and o.active and o.id <> s.id))
        returning s.id`;
      return gone.length > 0;
    });
  }
}

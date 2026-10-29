import type { PostInput, PostRepo, PostRow } from '../ports.js';
import type { Sql } from './pg.js';

interface Row {
  id: string;
  author_id: string | null;
  author_name: string | null;
  cohort_id: string | null;
  title: string;
  body: string;
  session_starts_at: Date | null;
  session_minutes: number | null;
  session_link: string | null;
  created_at: Date;
  edited_at: Date | null;
}

const toRow = (r: Row): PostRow => ({
  id: r.id,
  authorId: r.author_id,
  authorName: r.author_name,
  cohortId: r.cohort_id,
  title: r.title,
  body: r.body,
  session:
    r.session_starts_at && r.session_minutes !== null
      ? {
          startsAt: r.session_starts_at.toISOString(),
          minutes: r.session_minutes,
          link: r.session_link,
        }
      : null,
  createdAt: r.created_at.toISOString(),
  editedAt: r.edited_at?.toISOString() ?? null,
});

export class PgPostRepo implements PostRepo {
  constructor(private readonly sql: Sql) {}

  /** The columns of a post, with the author's name only while that staff member is active. */
  private select(): ReturnType<Sql> {
    return this.sql`
      select p.id, p.author_id, case when s.active then s.name end as author_name, p.cohort_id,
             p.title, p.body, p.session_starts_at, p.session_minutes, p.session_link,
             p.created_at, p.edited_at
      from community_posts p left join staff s on s.id = p.author_id`;
  }

  async save(post: PostInput, at: Date): Promise<string> {
    const session = post.session;
    const [saved] = await this.sql<{ id: string }[]>`
      insert into community_posts
        (id, author_id, cohort_id, title, body, session_starts_at, session_minutes, session_link,
         created_at)
      values (coalesce(${post.id ?? null}::uuid, gen_random_uuid()), ${post.authorId},
              ${post.cohortId}, ${post.title}, ${post.body}, ${session?.startsAt ?? null},
              ${session?.minutes ?? null}, ${session?.link ?? null}, ${at})
      on conflict (id) do update
        set cohort_id = excluded.cohort_id, title = excluded.title, body = excluded.body,
            session_starts_at = excluded.session_starts_at,
            session_minutes = excluded.session_minutes, session_link = excluded.session_link,
            edited_at = ${at}
      returning id`;
    return saved?.id ?? '';
  }

  async get(id: string): Promise<PostRow | null> {
    const [row] = await this.sql<Row[]>`${this.select()} where p.id = ${id}`;
    return row ? toRow(row) : null;
  }

  async feed(cohortId: string | null, limit: number): Promise<PostRow[]> {
    const rows = await this.sql<Row[]>`
      ${this.select()}
      where p.cohort_id is null or p.cohort_id = ${cohortId}::uuid
      order by p.created_at desc, p.id desc limit ${limit}`;
    return rows.map(toRow);
  }

  async list(
    scope: { cohortIds: string[] | 'all'; authorId: string },
    limit: number,
  ): Promise<PostRow[]> {
    const all = scope.cohortIds === 'all';
    const cohorts = scope.cohortIds === 'all' ? [] : scope.cohortIds;
    const rows = await this.sql<Row[]>`
      ${this.select()}
      where ${all} or p.author_id = ${scope.authorId} or p.cohort_id is null
         or p.cohort_id = any(${cohorts}::uuid[])
      order by p.created_at desc, p.id desc limit ${limit}`;
    return rows.map(toRow);
  }

  async delete(id: string): Promise<boolean> {
    const gone = await this.sql`delete from community_posts where id = ${id} returning id`;
    return gone.length > 0;
  }
}

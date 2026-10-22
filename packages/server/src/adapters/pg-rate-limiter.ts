import type { RateLimiter } from '../ports.js';
import type { Sql } from './pg.js';

/** Fixed windows in Postgres: one row per bucket and window, counted atomically. */
export class PgRateLimiter implements RateLimiter {
  constructor(private readonly sql: Sql) {}

  async hit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
    const rows = await this.sql<{ hits: number }[]>`
      insert into rate_limits (bucket, window_start, hits)
      values (${bucket},
              to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}),
              1)
      on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1
      returning hits`;
    return (rows[0]?.hits ?? Number.POSITIVE_INFINITY) <= limit;
  }

  async count(bucket: string, windowSeconds: number): Promise<number> {
    const rows = await this.sql<{ hits: number }[]>`
      select hits from rate_limits
      where bucket = ${bucket}
        and window_start =
          to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds})`;
    return rows[0]?.hits ?? 0;
  }

  /** Remove windows that ended long ago; returns how many rows went. */
  async prune(olderThanSeconds: number): Promise<number> {
    const result = await this.sql`
      delete from rate_limits
      where window_start < now() - make_interval(secs => ${olderThanSeconds})`;
    return result.count;
  }
}

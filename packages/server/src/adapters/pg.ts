import postgres from 'postgres';

export type Sql = postgres.Sql;

const MAX_CONNECTIONS = 5;
const IDLE_SECONDS = 20;

/** One connection pool per process. `prepare: false` because Supabase's pooler cannot keep them. */
export function createSql(url: string): Sql {
  return postgres(url, {
    max: MAX_CONNECTIONS,
    prepare: false,
    idle_timeout: IDLE_SECONDS,
    onnotice: () => undefined,
  });
}

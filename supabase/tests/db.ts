import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

/** The local stack's database (`npm run db:start`); CI uses the same default. */
export const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export type Sql = postgres.Sql;

export const connect = (): Sql => postgres(DB_URL, { max: 2, onnotice: () => undefined });

/** An auth user, a learner linked to it, in its own cohort. */
export async function makeLearner(
  sql: Sql,
  name: string,
): Promise<{ id: string; authId: string; cohortId: string }> {
  const authId = randomUUID();
  const id = randomUUID();
  const [cohort] = await sql<
    { id: string }[]
  >`insert into cohorts (name) values (${`cohort of ${name}`}) returning id`;
  await sql`insert into auth.users (id, instance_id, aud, role, email)
            values (${authId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${`${authId}@test.local`})`;
  await sql`insert into learners (id, name, cohort_id) values (${id}, ${name}, ${cohort?.id ?? null})`;
  await sql`insert into learner_identities (auth_user_id, learner_id) values (${authId}, ${id})`;
  return { id, authId, cohortId: cohort?.id ?? '' };
}

export async function addEvent(sql: Sql, learnerId: string): Promise<string> {
  const id = randomUUID();
  await sql`insert into learner_events (id, learner_id, type, at, data)
            values (${id}, ${learnerId}, 'language_changed', now(), ${sql.json({ preference: 'hi_en' })})`;
  return id;
}

export async function removeLearner(
  sql: Sql,
  learner: { id: string; authId: string; cohortId: string },
): Promise<void> {
  await sql`delete from auth.users where id = ${learner.authId}`;
  await sql`delete from learners where id = ${learner.id}`;
  await sql`delete from cohorts where id = ${learner.cohortId}`;
}

/** Run `work` as a signed-in user (role `authenticated`, the user's id in the JWT claims). */
export async function asUser<T>(
  sql: Sql,
  authId: string,
  work: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: authId, role: 'authenticated' })}, true)`;
    return work(tx);
  })) as T;
}

export async function asAnon<T>(
  sql: Sql,
  work: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`set local role anon`;
    return work(tx);
  })) as T;
}

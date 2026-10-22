import { afterAll } from 'vitest';
import { localStack } from '../../../supabase/tests/stack.js';
import { PgCodeRepo } from '../src/adapters/pg-code-repo.js';
import { PgLearnerRepo } from '../src/adapters/pg-learner-repo.js';
import { PgRateLimiter } from '../src/adapters/pg-rate-limiter.js';
import { PgSwitchRepo } from '../src/adapters/pg-switch-repo.js';
import { createSql } from '../src/adapters/pg.js';
import { createSupabaseAuth } from '../src/adapters/supabase-auth.js';
import { describeCodeContract } from '../src/testing/code-contract.js';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = createSql(DB_URL);

afterAll(async () => {
  await sql.end();
});

describeCodeContract('Postgres and Supabase Auth', () => {
  const auth = createSupabaseAuth(localStack().apiUrl, localStack().serviceKey);
  const made: string[] = [];
  const tracked = {
    ...auth,
    async createCodeUser(password: string) {
      const user = await auth.createCodeUser(password);
      made.push(user.authUserId);
      return user;
    },
  };
  return Promise.resolve({
    deps: {
      learners: new PgLearnerRepo(sql),
      switches: new PgSwitchRepo(sql),
      codes: new PgCodeRepo(sql),
      auth: tracked,
      limiter: new PgRateLimiter(sql),
      pepper: 'db-test-pepper-0123456789abcdef0123',
    },
    async storedRow(learnerId) {
      const rows = await sql`select * from login_codes where learner_id = ${learnerId}`;
      return (rows[0] as Record<string, unknown> | undefined) ?? null;
    },
    async cleanup() {
      for (const id of made) {
        await sql`delete from learners where id in
          (select learner_id from learner_identities where auth_user_id = ${id})`;
        await auth.deleteUser(id);
      }
      await sql`delete from rate_limits where bucket = 'code:all'`;
    },
  });
});

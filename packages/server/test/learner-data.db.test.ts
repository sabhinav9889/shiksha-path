import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { deleteUser, localStack, makeUser } from '../../../supabase/tests/stack.js';
import { PgAttendanceRepo } from '../src/adapters/pg-attendance-repo.js';
import { PgAuditRepo } from '../src/adapters/pg-audit-repo.js';
import { PgCodeRepo } from '../src/adapters/pg-code-repo.js';
import { PgLearnerDataRepo } from '../src/adapters/pg-learner-data-repo.js';
import { PgLearnerRepo } from '../src/adapters/pg-learner-repo.js';
import { PgRateLimiter } from '../src/adapters/pg-rate-limiter.js';
import { PgRecordingRepo } from '../src/adapters/pg-recording-repo.js';
import { PgSwitchRepo } from '../src/adapters/pg-switch-repo.js';
import { createSql } from '../src/adapters/pg.js';
import { createSupabaseAuth } from '../src/adapters/supabase-auth.js';
import { createSupabaseRecordingStorage } from '../src/adapters/supabase-recording-storage.js';
import { issueCode } from '../src/services/codes.js';
import {
  deleteLearner,
  exportLearner,
  type LearnerDataDeps,
} from '../src/services/learner-data.js';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = createSql(DB_URL);
const { apiUrl, serviceKey } = localStack();
const bucket = createClient(apiUrl, serviceKey, { auth: { persistSession: false } }).storage.from(
  'recordings',
);

const deps = (): LearnerDataDeps => ({
  attendance: new PgAttendanceRepo(sql),
  audit: new PgAuditRepo(sql),
  data: new PgLearnerDataRepo(sql),
  recordings: new PgRecordingRepo(sql),
  storage: createSupabaseRecordingStorage(apiUrl, serviceKey),
  auth: createSupabaseAuth(apiUrl, serviceKey),
});

interface Learner {
  id: string;
  authId: string;
  recordingId: string;
}

/** A Google-linked learner in their own cohort, with an event, an override and a recording. */
async function makeLearner(name: string): Promise<Learner> {
  const user = await makeUser();
  const id = randomUUID();
  const [cohort] = await sql<{ id: string }[]>`
    insert into cohorts (name) values (${`cohort ${name}`}) returning id`;
  await sql`insert into learners (id, name, cohort_id) values (${id}, ${name}, ${cohort?.id ?? null})`;
  await sql`insert into learner_identities (auth_user_id, learner_id) values (${user.id}, ${id})`;
  await sql`insert into learner_events (id, learner_id, type, at, data)
            values (${randomUUID()}, ${id}, 'language_changed', now(),
                    ${sql.json({ preference: 'hi_en' })})`;
  await sql`insert into feature_overrides (learner_id, key, enabled)
            values (${id}, 'placement_test', false)`;
  await sql`insert into lab_attendance (learner_id, day, present) values (${id}, '2026-10-20', true)`;
  for (const bucket of [`recording:${id}`, `sync:${id}`]) {
    await sql`insert into rate_limits (bucket, window_start) values (${bucket}, now())`;
  }
  const recordingId = randomUUID();
  await sql`insert into recordings (id, learner_id, lesson_id, item_id, mime, bytes, duration_ms,
                                    recorded_at, status, uploaded_at)
            values (${recordingId}, ${id}, 'ef1-02', 's1', 'audio/webm', 3, 1000, now(),
                    'uploaded', now())`;
  const { error } = await bucket.upload(`${id}/${recordingId}`, Uint8Array.of(7, 8, 9), {
    contentType: 'audio/webm',
  });
  if (error) throw new Error('could not upload the test recording');
  return { id, authId: user.id, recordingId };
}

/** Every row anywhere in `public` that still names the learner (in any text, id or JSON
 * column, also inside a longer value such as a rate-limit bucket), except the tombstone. */
async function rowsNaming(learnerId: string): Promise<Record<string, number>> {
  const columns = await sql<{ table_name: string; column_name: string }[]>`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name <> 'deleted_learners'
      and data_type in ('uuid', 'text', 'character varying', 'jsonb')`;
  const found: Record<string, number> = {};
  for (const { table_name, column_name } of columns) {
    // Names come from the catalogue above, never from input.
    const [row] = await sql.unsafe<{ n: number }[]>(
      `select count(*)::int as n from public.${table_name}
       where position($1 in ${column_name}::text) > 0`,
      [learnerId],
    );
    if ((row?.n ?? 0) > 0) found[`${table_name}.${column_name}`] = row?.n ?? 0;
  }
  return found;
}

let a: Learner;
let b: Learner;

beforeEach(async () => {
  [a, b] = [await makeLearner('A'), await makeLearner('B')];
});

afterEach(async () => {
  for (const l of [a, b]) {
    await bucket.remove([`${l.id}/${l.recordingId}`]);
    await sql`delete from learners where id = ${l.id}`;
    await sql`delete from deleted_learners where id = ${l.id}`;
    await sql`delete from rate_limits where bucket like ${`%:${l.id}`}`;
    await deleteUser(l.authId).catch(() => undefined);
  }
});

afterAll(async () => {
  await sql.end();
});

describe('export', () => {
  test("holds exactly A's learner, sign-in email, events, overrides and recordings", async () => {
    const out = await exportLearner(deps(), a.id);
    expect(out.data.learner.id).toBe(a.id);
    expect(out.data.identities).toHaveLength(1);
    expect(out.data.identities[0]?.email).toMatch(/@test\.local$/);
    expect(out.data.events).toHaveLength(1);
    expect(out.data.overrides).toEqual({ placement_test: false });
    expect(out.data.attendance).toEqual([{ date: '2026-10-20', present: true }]);
    expect(out.data.learner.deactivated).toBe(false);
    expect(out.recordings.map((r) => [r.id, [...r.bytes]])).toEqual([[a.recordingId, [7, 8, 9]]]);
    expect(JSON.stringify(out.data)).not.toContain(b.id);
  });
});

describe('delete', () => {
  test('removes every row, object and sign-in of A, leaves a tombstone, and leaves B alone', async () => {
    const counts = await deleteLearner(deps(), a.id);
    expect(counts).toEqual({ events: 1, recordings: 1, authUsers: 1 });
    expect(await rowsNaming(a.id)).toEqual({});
    expect((await bucket.list(a.id)).data).toEqual([]);
    expect(await createSupabaseAuth(apiUrl, serviceKey).emailOf(a.authId)).toBeNull();
    expect(await sql`select id from deleted_learners where id = ${a.id}`).toHaveLength(1);
    expect(Object.keys(await rowsNaming(b.id)).length).toBeGreaterThanOrEqual(4);
    expect((await bucket.list(b.id)).data).toHaveLength(1);
    expect(await rowsNaming(b.id)).toHaveProperty(['rate_limits.bucket'], 2);
  });

  test('their audit entries stay, but no longer name them', async () => {
    await new PgAuditRepo(sql).add({
      staffId: null,
      action: 'level_set',
      learnerId: a.id,
      details: { track: 'english' },
    });
    await deleteLearner(deps(), a.id);
    expect(await sql`select 1 from audit_log where learner_id = ${a.id}`).toHaveLength(0);
    const [row] = await sql<{ details: Record<string, string> }[]>`
      select details from audit_log where details->>'track' = 'english'
      order by id desc limit 1`;
    expect(row?.details).toEqual({ track: 'english', learner: 'DELETED' });
  });

  test('a file with no row under the learner (a late upload) goes too', async () => {
    await bucket.upload(`${a.id}/${randomUUID()}`, Uint8Array.of(1), { contentType: 'audio/webm' });
    await deleteLearner(deps(), a.id);
    expect((await bucket.list(a.id)).data).toEqual([]);
  });

  test('a code student loses their code and its sign-in too', async () => {
    const codeDeps = {
      learners: new PgLearnerRepo(sql),
      switches: new PgSwitchRepo(sql),
      codes: new PgCodeRepo(sql),
      auth: createSupabaseAuth(apiUrl, serviceKey),
      limiter: new PgRateLimiter(sql),
      pepper: 'db-test-pepper-0123456789abcdef0123',
    };
    const { learnerId } = await issueCode(codeDeps, { name: 'कोड' });
    const [code] = await sql<{ auth_user_id: string }[]>`
      select auth_user_id from login_codes where learner_id = ${learnerId}`;
    expect(await deleteLearner(deps(), learnerId)).toMatchObject({ authUsers: 1 });
    expect(await rowsNaming(learnerId)).toEqual({});
    expect(await codeDeps.auth.emailOf(code?.auth_user_id ?? '')).toBeNull();
    await sql`delete from deleted_learners where id = ${learnerId}`;
  });

  test('a storage failure stops before anything in the database is deleted', async () => {
    const broken = {
      ...deps(),
      storage: { ...deps().storage, remove: () => Promise.reject(new Error('down')) },
    };
    await expect(deleteLearner(broken, a.id)).rejects.toThrow();
    expect(Object.keys(await rowsNaming(a.id)).length).toBeGreaterThanOrEqual(4);
    expect(await createSupabaseAuth(apiUrl, serviceKey).emailOf(a.authId)).not.toBeNull();
  });

  test('running it again after a partial failure finishes the job', async () => {
    await createSupabaseAuth(apiUrl, serviceKey).deleteUser(a.authId); // as if the run stopped here
    await deleteLearner(deps(), a.id);
    expect(await rowsNaming(a.id)).toEqual({});
  });
});

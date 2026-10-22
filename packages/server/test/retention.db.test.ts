import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PgLearnerDataRepo } from '../src/adapters/pg-learner-data-repo.js';
import { PgRateLimiter } from '../src/adapters/pg-rate-limiter.js';
import { PgRecordingRepo } from '../src/adapters/pg-recording-repo.js';
import { createSql } from '../src/adapters/pg.js';
import { runRetention } from '../src/services/retention.js';
import { memoryRecordingStorage } from '../src/testing/memory-recording-storage.js';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = createSql(DB_URL);
const NOW = new Date('2026-12-31T00:00:00.000Z');
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);

let learners: string[];
let storage: ReturnType<typeof memoryRecordingStorage>;

async function learner(): Promise<string> {
  const id = randomUUID();
  await sql`insert into learners (id, name) values (${id}, 'R')`;
  learners.push(id);
  return id;
}

/** A recording row (and its object) with the dates a case needs. */
async function recording(
  learnerId: string,
  dates: { reviewed?: number; uploaded?: number; started?: number },
): Promise<string> {
  const id = randomUUID();
  const status = dates.uploaded === undefined ? 'pending' : 'uploaded';
  await sql`
    insert into recordings (id, learner_id, lesson_id, item_id, mime, bytes, duration_ms,
                            recorded_at, status, uploaded_at, reviewed_at, created_at)
    values (${id}, ${learnerId}, 'ef1-02', 's1', 'audio/webm', 3, 1000, ${daysAgo(200)},
            ${status},
            ${dates.uploaded === undefined ? null : daysAgo(dates.uploaded)},
            ${dates.reviewed === undefined ? null : daysAgo(dates.reviewed)},
            ${daysAgo(dates.started ?? dates.uploaded ?? 0)})`;
  storage.put(`${learnerId}/${id}`, 3);
  return id;
}

const deps = () => ({
  data: new PgLearnerDataRepo(sql),
  recordings: new PgRecordingRepo(sql),
  storage,
  limiter: new PgRateLimiter(sql),
});
const kept = async (id: string): Promise<boolean> =>
  (await sql`select 1 from recordings where id = ${id}`).length === 1;

beforeEach(() => {
  learners = [];
  storage = memoryRecordingStorage();
});

afterEach(async () => {
  for (const id of learners) await sql`delete from learners where id = ${id}`;
});

afterAll(async () => {
  await sql.end();
});

describe('retention', () => {
  test('reviewed recordings go 30 days after review; unreviewed 90 days after upload', async () => {
    const a = await learner();
    const reviewed31 = await recording(a, { uploaded: 60, reviewed: 31 });
    const reviewed29 = await recording(a, { uploaded: 60, reviewed: 29 });
    const unreviewed91 = await recording(a, { uploaded: 91 });
    const unreviewed89 = await recording(a, { uploaded: 89 });
    const pending8 = await recording(a, { started: 8 });
    const pending6 = await recording(a, { started: 6 });
    const out = await runRetention(deps(), NOW);
    expect(out.recordings).toBe(3);
    expect(await kept(reviewed31)).toBe(false);
    expect(await kept(reviewed29)).toBe(true);
    expect(await kept(unreviewed91)).toBe(false);
    expect(await kept(unreviewed89)).toBe(true);
    expect(await kept(pending8)).toBe(false);
    expect(await kept(pending6)).toBe(true);
    expect(storage.paths()).toEqual(
      [reviewed29, unreviewed89, pending6].map((id) => `${a}/${id}`).sort(),
    );
  });

  test("each learner's recordings are judged on their own dates", async () => {
    const [a, b] = [await learner(), await learner()];
    const old = await recording(a, { uploaded: 120 });
    const fresh = await recording(b, { uploaded: 10 });
    await runRetention(deps(), NOW);
    expect(await kept(old)).toBe(false);
    expect(await kept(fresh)).toBe(true);
  });

  test('running it twice removes nothing more', async () => {
    const a = await learner();
    await recording(a, { uploaded: 120 });
    await recording(a, { uploaded: 5 });
    await runRetention(deps(), NOW);
    expect((await runRetention(deps(), NOW)).recordings).toBe(0);
  });

  test("a file uploaded after its student was deleted is swept from that student's folder", async () => {
    const gone = randomUUID();
    await sql`insert into deleted_learners (id) values (${gone})`;
    storage.put(`${gone}/${randomUUID()}`, 3);
    await runRetention(deps(), new Date());
    expect(storage.paths()).toEqual([]);
    await sql`delete from deleted_learners where id = ${gone}`;
  });

  test('rate-limit windows older than a day are pruned', async () => {
    const bucket = `retention-test:${randomUUID()}`;
    await sql`insert into rate_limits (bucket, window_start, hits)
              values (${bucket}, now() - interval '2 days', 1), (${bucket}, now(), 1)`;
    const out = await runRetention(deps(), NOW);
    expect(out.rateWindows).toBeGreaterThanOrEqual(1);
    expect(await sql`select 1 from rate_limits where bucket = ${bucket}`).toHaveLength(1);
    await sql`delete from rate_limits where bucket = ${bucket}`;
  });
});

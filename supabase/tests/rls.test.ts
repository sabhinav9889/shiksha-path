import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { addEvent, asAnon, asUser, connect, makeLearner, removeLearner } from './db.js';

const sql = connect();
type Learner = Awaited<ReturnType<typeof makeLearner>>;
let a: Learner;
let b: Learner;

beforeEach(async () => {
  a = await makeLearner(sql, 'A');
  b = await makeLearner(sql, 'B');
  for (const learner of [a, b]) {
    await addEvent(sql, learner.id);
    await sql`insert into feature_overrides (learner_id, key, enabled) values (${learner.id}, 'speaking_practice', false)`;
  }
});

afterEach(async () => {
  await removeLearner(sql, a);
  await removeLearner(sql, b);
});

afterAll(async () => {
  await sql.end();
});

const TABLES = [
  'cohorts',
  'learners',
  'learner_identities',
  'learner_events',
  'feature_switches',
  'feature_overrides',
];

describe('a signed-in student sees only their own rows (2 students, 2 cohorts)', () => {
  test.each([
    ['A', () => a, () => b],
    ['B', () => b, () => a],
  ])('%s', async (_name, me, other) => {
    const mine = me();
    const theirs = other();
    await asUser(sql, mine.authId, async (tx) => {
      expect((await tx`select id from learners`).map((r) => r.id)).toEqual([mine.id]);
      expect(
        (await tx`select learner_id from learner_identities`).map((r) => r.learner_id),
      ).toEqual([mine.id]);
      const events = await tx`select learner_id from learner_events`;
      expect(events.length).toBe(1);
      expect(events.every((e) => e.learner_id === mine.id)).toBe(true);
      expect((await tx`select learner_id from feature_overrides`).map((r) => r.learner_id)).toEqual(
        [mine.id],
      );
      expect((await tx`select id from cohorts`).length).toBe(0);
      expect((await tx`select id from learner_events where learner_id = ${theirs.id}`).length).toBe(
        0,
      );
    });
  });

  test('every student can read the all-students switches', async () => {
    await asUser(sql, a.authId, async (tx) => {
      const keys = (await tx`select key from feature_switches order by key`).map((r) => r.key);
      expect(keys).toEqual([
        'ai_doubts',
        'community_feed',
        'english_only_option',
        'mentor_booking',
        'placement_test',
        'speaking_practice',
      ]);
    });
  });
});

type Tx = postgres.TransactionSql;

describe('nobody writes through the database API', () => {
  test('a student cannot insert an event, even for themselves', async () => {
    await expect(
      asUser(
        sql,
        a.authId,
        (tx) => tx`insert into learner_events (id, learner_id, type, at, data)
        values (${randomUUID()}, ${a.id}, 'language_changed', now(), '{}'::jsonb)`,
      ),
    ).rejects.toThrow();
  });

  test.each([
    ['learners', "update learners set name = 'x'"],
    ['learner_events', "update learner_events set type = 'x'"],
    ['feature_switches', 'update feature_switches set enabled_for_all = false'],
    ['feature_overrides', 'update feature_overrides set enabled = true'],
    ['learners (delete)', 'delete from learners'],
    ['learner_events (delete)', 'delete from learner_events'],
    ['learner_identities (delete)', 'delete from learner_identities'],
    ['learner_identities', 'update learner_identities set learner_id = learner_id'],
    ['cohorts', "update cohorts set name = 'x'"],
    ['cohorts (delete)', 'delete from cohorts'],
    ['feature_switches (delete)', 'delete from feature_switches'],
    ['feature_overrides (delete)', 'delete from feature_overrides'],
  ])('a student changes nothing in %s: it is refused outright', async (_table, statement) => {
    // Plan 3b removed the write grants, so these no longer even reach RLS.
    await expect(asUser(sql, a.authId, (tx) => tx.unsafe(statement))).rejects.toThrow(
      /permission denied/,
    );
  });

  test.each([
    ['learners', (tx: Tx) => tx`insert into learners (id, name) values (${randomUUID()}, 'x')`],
    ['cohorts', (tx: Tx) => tx`insert into cohorts (id, name) values (${randomUUID()}, 'x')`],
    [
      'feature_switches',
      (tx: Tx) => tx`insert into feature_switches (key, enabled_for_all) values ('x', true)`,
    ],
    [
      'feature_overrides',
      (tx: Tx) => tx`insert into feature_overrides (learner_id, key, enabled)
        values (${a.id}, 'ai_doubts', false)`,
    ],
  ] as const)('a student cannot insert into %s', async (_table, insert) => {
    await expect(asUser(sql, a.authId, insert)).rejects.toThrow();
  });

  test('a student cannot link themselves to another learner', async () => {
    await expect(
      asUser(
        sql,
        b.authId,
        (tx) =>
          tx`insert into learner_identities (auth_user_id, learner_id) values (${b.authId}, ${a.id})`,
      ),
    ).rejects.toThrow();
  });
});

describe('an anonymous caller sees nothing', () => {
  // Plan 3b removed every grant to anon, so the read is refused before RLS is even asked.
  test.each(TABLES)('%s: refused outright', async (table) => {
    await expect(asAnon(sql, (tx) => tx.unsafe(`select * from ${table}`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('database hardening', () => {
  const TABLES = [
    'cohorts',
    'learners',
    'learner_identities',
    'learner_events',
    'feature_switches',
    'feature_overrides',
  ];

  test('anon holds no privilege and authenticated may only select', async () => {
    const grants = await sql<{ grantee: string; table_name: string; privilege_type: string }[]>`
      select grantee, table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
        and table_name = any(${TABLES})`;
    expect(grants.filter((g) => g.grantee === 'anon')).toEqual([]);
    expect(
      grants.filter((g) => g.grantee === 'authenticated' && g.privilege_type !== 'SELECT'),
    ).toEqual([]);
  });

  test('GraphQL is not installed', async () => {
    const rows = await sql`select 1 from pg_extension where extname = 'pg_graphql'`;
    expect(rows).toHaveLength(0);
  });
});

describe('recordings rows', () => {
  test('each student reads only their own recordings, and the bucket is private', async () => {
    for (const learner of [a, b]) {
      await sql`insert into recordings (id, learner_id, lesson_id, item_id, mime, bytes,
                                       duration_ms, recorded_at)
                values (${randomUUID()}, ${learner.id}, 'ef1-02', 's1', 'audio/webm', 10, 1000,
                        now())`;
    }
    for (const [mine, theirs] of [
      [a, b],
      [b, a],
    ] as const) {
      await asUser(sql, mine.authId, async (tx) => {
        const rows = await tx`select learner_id from recordings`;
        expect(rows.map((r) => r.learner_id)).toEqual([mine.id]);
        expect(await tx`select 1 from recordings where learner_id = ${theirs.id}`).toHaveLength(0);
      });
    }
    const [bucket] = await sql<{ public: boolean; file_size_limit: number }[]>`
      select public, file_size_limit::int as file_size_limit from storage.buckets
      where id = 'recordings'`;
    expect(bucket).toEqual({ public: false, file_size_limit: 1048576 });
  });
});

describe('staff see only what their role allows (2 mentors, 2 cohorts)', () => {
  async function mentorOf(cohortId: string, role = 'mentor'): Promise<string> {
    const authId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email)
              values (${authId}, '00000000-0000-0000-0000-000000000000', 'authenticated',
                      'authenticated', ${`${authId}@ngo.example`})`;
    const [staff] = await sql<{ id: string }[]>`
      insert into staff (email, role, name, auth_user_id)
      values (${`${authId}@ngo.example`}, ${role}, 'M', ${authId}) returning id`;
    if (role === 'mentor') {
      await sql`insert into staff_cohorts (staff_id, cohort_id) values (${staff?.id ?? ''}, ${cohortId})`;
    }
    return authId;
  }

  afterEach(async () => {
    await sql`delete from auth.users where email like '%@ngo.example'`;
    await sql`delete from staff where email like '%@ngo.example'`;
  });

  test("a mentor reads their cohort's learners, events and recordings, and nothing else", async () => {
    for (const learner of [a, b]) {
      await sql`insert into recordings (id, learner_id, lesson_id, item_id, mime, bytes,
                                       duration_ms, recorded_at)
                values (${randomUUID()}, ${learner.id}, 'ef1-02', 's1', 'audio/webm', 1, 1, now())`;
    }
    const mentorA = await mentorOf(a.cohortId);
    await asUser(sql, mentorA, async (tx) => {
      expect((await tx`select id from learners`).map((r) => r.id)).toEqual([a.id]);
      const events = await tx`select learner_id from learner_events`;
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => e.learner_id === a.id)).toBe(true);
      expect((await tx`select learner_id from recordings`).map((r) => r.learner_id)).toEqual([
        a.id,
      ]);
      expect(await tx`select 1 from learners where id = ${b.id}`).toHaveLength(0);
    });
  });

  test('an admin reads every learner; a student sees no staff rows', async () => {
    const admin = await mentorOf(a.cohortId, 'admin');
    await asUser(sql, admin, async (tx) => {
      const ids = (await tx`select id from learners where id in (${a.id}, ${b.id})`).map(
        (r) => r.id,
      );
      expect(ids.sort()).toEqual([a.id, b.id].sort());
    });
    await mentorOf(b.cohortId);
    await asUser(sql, a.authId, async (tx) => {
      expect(await tx`select id from staff`).toHaveLength(0);
    });
  });

  test('summaries and attendance follow the same scope; students and writes are refused', async () => {
    for (const learner of [a, b]) {
      await sql`insert into learner_summaries (learner_id, summary)
                values (${learner.id}, ${sql.json({ lessonsDone: 1 })})`;
      await sql`insert into lab_attendance (learner_id, day, present)
                values (${learner.id}, '2026-10-20', true)`;
    }
    const mentorA = await mentorOf(a.cohortId);
    await asUser(sql, mentorA, async (tx) => {
      const summaries = await tx`select learner_id from learner_summaries`;
      expect(summaries.map((r) => r.learner_id)).toEqual([a.id]);
      const attendance = await tx`select learner_id from lab_attendance`;
      expect(attendance.map((r) => r.learner_id)).toEqual([a.id]);
    });
    await expect(
      asUser(sql, mentorA, (tx) => tx`update learner_summaries set summary = '{}'::jsonb`),
    ).rejects.toThrow();
    await expect(
      asUser(
        sql,
        mentorA,
        (tx) =>
          tx`insert into lab_attendance (learner_id, day, present)
             values (${a.id}, '2026-10-21', true)`,
      ),
    ).rejects.toThrow();
    const admin = await mentorOf(a.cohortId, 'admin');
    await asUser(sql, admin, async (tx) => {
      const both = await tx`select learner_id from learner_summaries
                            where learner_id in (${a.id}, ${b.id})`;
      expect(both.map((r) => r.learner_id).sort()).toEqual([a.id, b.id].sort());
    });
    await asUser(sql, a.authId, async (tx) => {
      expect(await tx`select 1 from learner_summaries`).toHaveLength(0);
      expect(await tx`select 1 from lab_attendance`).toHaveLength(0);
    });
  });

  test('community posts follow the audience: 2 cohorts, 2 students, 2 mentors, an admin', async () => {
    const post = async (cohortId: string | null, title: string, author?: string): Promise<void> => {
      await sql`insert into community_posts (cohort_id, title, author_id)
                values (${cohortId}, ${title}, ${author ?? null})`;
    };
    const titles = (rows: { title: string }[]): string[] => rows.map((r) => r.title).sort();
    await post(null, 'all');
    await post(a.cohortId, 'only-a');
    await post(b.cohortId, 'only-b');
    const mentorA = await mentorOf(a.cohortId);
    const admin = await mentorOf(a.cohortId, 'admin');
    const read = (authId: string) =>
      asUser(sql, authId, async (tx) =>
        titles(await tx<{ title: string }[]>`select title from community_posts`),
      );
    expect(await read(a.authId)).toEqual(['all', 'only-a']);
    expect(await read(b.authId)).toEqual(['all', 'only-b']);
    expect(await read(mentorA)).toEqual(['all', 'only-a']);
    expect(await read(admin)).toEqual(['all', 'only-a', 'only-b']);
    // A mentor keeps reading their own post even when it is for a cohort they no longer hold.
    const [me] = await sql<{ id: string }[]>`select id from staff where auth_user_id = ${mentorA}`;
    await post(b.cohortId, 'own-b', me?.id);
    expect(await read(mentorA)).toEqual(['all', 'only-a', 'own-b']);
    await sql`update staff set active = false where auth_user_id = ${mentorA}`;
    expect(await read(mentorA)).toEqual([]);
    await expect(asAnon(sql, (tx) => tx`select title from community_posts`)).rejects.toThrow();
    await sql`delete from community_posts`;
  });

  test('nobody writes a post through the database API, and a deleted cohort takes its posts', async () => {
    const [cohort] = await sql<
      { id: string }[]
    >`insert into cohorts (name) values ('Gone') returning id`;
    await sql`insert into community_posts (cohort_id, title) values (${cohort?.id ?? ''}, 'to-gone')`;
    const admin = await mentorOf(a.cohortId, 'admin');
    for (const authId of [a.authId, admin]) {
      await expect(
        asUser(sql, authId, (tx) => tx`insert into community_posts (title) values ('x')`),
      ).rejects.toThrow();
      await expect(
        asUser(sql, authId, (tx) => tx`update community_posts set title = 'y'`),
      ).rejects.toThrow();
      await expect(asUser(sql, authId, (tx) => tx`delete from community_posts`)).rejects.toThrow();
    }
    await sql`delete from cohorts where id = ${cohort?.id ?? ''}`;
    // Not turned into a post to everyone: it is gone, so no student can read it.
    expect(await sql`select 1 from community_posts where title = 'to-gone'`).toHaveLength(0);
    await asUser(sql, a.authId, async (tx) => {
      expect(await tx`select 1 from community_posts where title = 'to-gone'`).toHaveLength(0);
    });
  });

  test('an inactive mentor reads nothing', async () => {
    const mentorA = await mentorOf(a.cohortId);
    await sql`update staff set active = false where auth_user_id = ${mentorA}`;
    await asUser(sql, mentorA, async (tx) => {
      expect(await tx`select id from learners`).toHaveLength(0);
    });
  });
});

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
  ])('a student changes nothing in %s', async (_table, statement) => {
    const changed = await asUser(sql, a.authId, (tx) => tx.unsafe(statement));
    expect(changed.count).toBe(0);
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
  test.each(TABLES)('%s', async (table) => {
    const rows = await asAnon(sql, (tx) => tx.unsafe(`select * from ${table}`));
    expect(rows.length).toBe(0);
  });
});

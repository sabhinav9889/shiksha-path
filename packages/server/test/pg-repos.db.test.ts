import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cryptoIds, createEvent, systemClock } from '@shiksha/learner-core';
import { afterAll, describe, expect, test } from 'vitest';
import { PgBrandingRepo } from '../src/adapters/pg-branding-repo.js';
import { PgAuditRepo } from '../src/adapters/pg-audit-repo.js';
import { PgCodeRepo } from '../src/adapters/pg-code-repo.js';
import { PgEventRepo } from '../src/adapters/pg-event-repo.js';
import { PgOrgRepo } from '../src/adapters/pg-org-repo.js';
import { PgStaffRepo } from '../src/adapters/pg-staff-repo.js';
import { PgSummaryRepo } from '../src/adapters/pg-summary-repo.js';
import { PgLearnerDataRepo } from '../src/adapters/pg-learner-data-repo.js';
import { PgLearnerRepo } from '../src/adapters/pg-learner-repo.js';
import { PgRateLimiter } from '../src/adapters/pg-rate-limiter.js';
import { PgRecordingRepo } from '../src/adapters/pg-recording-repo.js';
import { memoryRecordingStorage } from '../src/testing/memory-recording-storage.js';
import { PgSwitchRepo } from '../src/adapters/pg-switch-repo.js';
import { createSql } from '../src/adapters/pg.js';
import { describeServiceContract, type ServiceFixture } from '../src/testing/service-contract.js';
import { describeStaffContract } from '../src/testing/staff-contract.js';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = createSql(DB_URL);

afterAll(async () => {
  await sql.end();
});

/** Real repositories on the local database; each test's users and learners are removed after. */
async function makePgFixture(): Promise<ServiceFixture> {
  const authUsers: string[] = [];
  return {
    learners: new PgLearnerRepo(sql),
    events: new PgEventRepo(sql),
    switches: new PgSwitchRepo(sql),
    limiter: new PgRateLimiter(sql),
    recordings: new PgRecordingRepo(sql),
    branding: new PgBrandingRepo(sql),
    data: new PgLearnerDataRepo(sql),
    staff: new PgStaffRepo(sql),
    org: new PgOrgRepo(sql),
    audit: new PgAuditRepo(sql),
    summaries: new PgSummaryRepo(sql),
    codes: new PgCodeRepo(sql),
    storage: memoryRecordingStorage(), // the real bucket is tested through the API
    async newAuthUser() {
      const id = randomUUID();
      await sql`insert into auth.users (id, instance_id, aud, role, email)
        values (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                ${`${id}@test.local`})`;
      authUsers.push(id);
      return id;
    },
    async setAllStudents(key, enabled) {
      await sql`update feature_switches set enabled_for_all = ${enabled} where key = ${key}`;
    },
    async setOverride(learnerId, key, enabled) {
      await sql`insert into feature_overrides (learner_id, key, enabled)
        values (${learnerId}, ${key}, ${enabled})
        on conflict (learner_id, key) do update set enabled = excluded.enabled`;
    },
    async removeSwitch(key) {
      await sql`delete from feature_switches where key = ${key}`;
    },
    async cleanup() {
      const linked = await sql<{ learner_id: string }[]>`
        select learner_id from learner_identities
        where auth_user_id in (select value::uuid from jsonb_array_elements_text(${sql.json(authUsers)}))`;
      for (const { learner_id } of linked) await sql`delete from learners where id = ${learner_id}`;
      for (const id of authUsers) await sql`delete from staff where auth_user_id = ${id}`;
      for (const id of authUsers) await sql`delete from auth.users where id = ${id}`;
      await sql`delete from staff where auth_user_id is null and email like '%@ngo.example'`;
      await sql`delete from cohorts where name in ('A', 'B') and lab_id in
                  (select id from labs where name = 'Lab')`;
      await sql`delete from labs where name = 'Lab'`;
      await sql`insert into feature_switches (key) values
        ('ai_doubts'), ('speaking_practice'), ('placement_test'),
        ('english_only_option'), ('mentor_booking'), ('community_feed')
        on conflict (key) do update set enabled_for_all = true`;
    },
  };
}

describeServiceContract('Postgres repositories', makePgFixture);
describeStaffContract('Postgres repositories', makePgFixture);

describe('Postgres specifics', () => {
  test('100 events go in with one call', async () => {
    const f = await makePgFixture();
    const auth = await f.newAuthUser();
    const id = randomUUID();
    await f.learners.createLinked({ id, name: 'A', authUserId: auth });
    const events = Array.from({ length: 100 }, () =>
      createEvent({ clock: systemClock, ids: cryptoIds }, id, 'language_changed', {
        preference: 'en_only',
      }),
    );
    const out = await f.events.insertMany(id, events);
    expect(out.inserted).toHaveLength(100);
    expect((await f.events.page(id, 0, 500)).events).toHaveLength(100);
    await f.cleanup();
  });

  test('deleting a learner removes their identity link, events and overrides', async () => {
    const f = await makePgFixture();
    const auth = await f.newAuthUser();
    const id = randomUUID();
    await f.learners.createLinked({ id, name: 'A', authUserId: auth });
    const event = createEvent({ clock: systemClock, ids: cryptoIds }, id, 'language_changed', {
      preference: 'hi_en',
    });
    await f.events.insertMany(id, [event]);
    await f.setOverride(id, 'placement_test', false);
    await sql`delete from learners where id = ${id}`;
    const left = await sql`
      select (select count(*) from learner_identities where learner_id = ${id})::int as identities,
             (select count(*) from learner_events where learner_id = ${id})::int as events,
             (select count(*) from feature_overrides where learner_id = ${id})::int as overrides`;
    expect(left[0]).toEqual({ identities: 0, events: 0, overrides: 0 });
    await f.cleanup();
  });

  test('a failed link leaves no learner behind', async () => {
    const f = await makePgFixture();
    const id = randomUUID();
    await expect(
      f.learners.createLinked({ id, name: 'A', authUserId: randomUUID() }), // no such auth user
    ).rejects.toThrow();
    expect(await f.learners.findById(id)).toBeNull();
    await f.cleanup();
  });

  test('the adapters build no SQL from strings', () => {
    const dir = fileURLToPath(new URL('../src/adapters', import.meta.url));
    for (const file of readdirSync(dir).filter((name) => name.startsWith('pg'))) {
      const code = readFileSync(join(dir, file), 'utf8');
      expect(code, file).not.toContain('.unsafe(');
      const outsideTags = code.replace(/\b(sql|tx)(<[^`]*?>)?`[\s\S]*?`/g, ''); // tagged, optionally typed;
      expect(outsideTags, file).not.toContain('${');
    }
  });
});

describe('pull visibility', () => {
  test('a pull never passes an event whose transaction has not committed yet', async () => {
    const learner = randomUUID();
    await sql`insert into learners (id, name) values (${learner}, 'race')`;
    const repo = new PgEventRepo(sql);
    const event = () =>
      createEvent({ clock: systemClock, ids: cryptoIds }, learner, 'language_changed', {
        preference: 'hi_en',
      });
    const slow = await sql.reserve();
    try {
      const first = event();
      await slow`begin`;
      await slow`insert into learner_events (id, learner_id, type, at, data)
        values (${first.id}, ${learner}, ${first.type}, ${first.at}, ${slow.json(first.data)})`;
      const second = event();
      await repo.insertMany(learner, [second]); // commits, with a higher seq
      expect((await repo.page(learner, 0, 100)).events).toEqual([]);
      await slow`commit`;
      const page = await repo.page(learner, 0, 100);
      expect(page.events.map((e) => e.id)).toEqual([first.id, second.id]);
    } finally {
      await slow`rollback`.catch(() => undefined); // never hand back an open transaction
      slow.release();
      await sql`delete from learners where id = ${learner}`;
    }
  });
});

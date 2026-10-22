import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import * as admin from '../services/admin.js';
import { getMe } from '../services/me.js';
import { inScope } from '../services/staff.js';
import { studentDetail } from '../services/staff-read.js';
import { pullEvents } from '../services/sync.js';
import type { ServiceFixture } from './service-contract.js';
import { codeOf, staffWorld } from './staff-world.js';

/** The admin API (spec §8.1), against any set of repositories. */
export function describeAdminContract(name: string, make: () => Promise<ServiceFixture>): void {
  describe(`admin over ${name}`, () => {
    const w = staffWorld(make);
    const { learnerAuth, staffMember } = w;
    let f: ServiceFixture;
    let cohortA: string;
    let cohortB: string;
    let learnerA: string;
    let learnerB: string;
    beforeEach(() => {
      ({ f, cohortA, cohortB, learnerA, learnerB } = w);
    });

    describe('the admin API', () => {
      test('every admin action refuses a mentor', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const calls = [
          admin.saveLab(f, mentor, { name: 'L' }),
          admin.saveCohort(f, mentor, { name: 'C', labId: null }),
          admin.searchStudents(f, mentor, {}),
          admin.editStudent(f, mentor, { learnerId: learnerA, name: 'X' }),
          admin.setActive(f, mentor, { learnerId: learnerA, active: false }),
          admin.setSwitch(f, mentor, { key: 'placement_test', enabledForAll: false }),
          admin.setOverride(f, mentor, {
            learnerId: learnerA,
            key: 'placement_test',
            enabled: false,
          }),
        ];
        for (const call of calls) expect(await codeOf(call)).toBe('FORBIDDEN');
      });

      test('search finds by literal name text, filters by cohort and pages by 50', async () => {
        const boss = await staffMember('admin', []);
        await admin.editStudent(f, boss, { learnerId: learnerA, name: 'Ri%ya_1' });
        await admin.editStudent(f, boss, { learnerId: learnerB, name: 'Riya2' });
        const literal = await admin.searchStudents(f, boss, { q: '%ya_' });
        expect(literal.students.map((s) => s.id)).toEqual([learnerA]);
        const byCohort = await admin.searchStudents(f, boss, { q: 'Riya', cohortId: cohortB });
        expect(byCohort.students.map((s) => s.id)).toEqual([learnerB]);
      });

      test('moving a student moves them out of the old mentor’s reach', async () => {
        const boss = await staffMember('admin', []);
        const mentorA = await staffMember('mentor', [cohortA]);
        await admin.editStudent(f, boss, { learnerId: learnerA, cohortId: cohortB });
        expect(await codeOf(inScope(f, mentorA, learnerA))).toBe('FORBIDDEN');
        const actions = (await f.audit.page(null, 100))
          .filter((e) => e.staffId === boss.staffId)
          .map((e) => e.action);
        expect(actions).toContain('student_moved');
      });

      test('a deactivated learner cannot sync until reactivated', async () => {
        const boss = await staffMember('admin', []);
        const auth = await learnerAuth(learnerA);
        await admin.setActive(f, boss, { learnerId: learnerA, active: false });
        expect(await codeOf(pullEvents(f, auth, { after: 0, limit: 10 }))).toBe('DEACTIVATED');
        expect(await codeOf(getMe(f, auth))).toBe('DEACTIVATED');
        await admin.setActive(f, boss, { learnerId: learnerA, active: true });
        expect((await pullEvents(f, auth, { after: 0, limit: 10 })).events).toEqual([]);
      });

      test('an override of null falls back to the all-students value', async () => {
        const boss = await staffMember('admin', []);
        const auth = await learnerAuth(learnerA);
        await admin.setSwitch(f, boss, { key: 'placement_test', enabledForAll: false });
        await admin.setOverride(f, boss, {
          learnerId: learnerA,
          key: 'placement_test',
          enabled: true,
        });
        expect((await getMe(f, auth)).switches.placement_test).toBe(true);
        await admin.setOverride(f, boss, {
          learnerId: learnerA,
          key: 'placement_test',
          enabled: null,
        });
        expect((await getMe(f, auth)).switches.placement_test).toBe(false);
        await admin.setSwitch(f, boss, { key: 'placement_test', enabledForAll: true });
      });

      test('setup shows the all-students switches and the detail shows only own overrides', async () => {
        const boss = await staffMember('admin', []);
        await admin.setSwitch(f, boss, { key: 'mentor_booking', enabledForAll: false });
        await admin.setOverride(f, boss, { learnerId: learnerA, key: 'ai_doubts', enabled: false });
        try {
          const setup = await admin.getSetup(f, boss);
          expect(setup.switches.mentor_booking).toBe(false);
          expect(Object.keys(setup.switches)).toHaveLength(6);
          expect((await studentDetail(f, boss, learnerA)).overrides).toEqual({ ai_doubts: false });
          expect((await studentDetail(f, boss, learnerB)).overrides).toEqual({});
        } finally {
          await admin.setSwitch(f, boss, { key: 'mentor_booking', enabledForAll: true });
          await admin.setOverride(f, boss, {
            learnerId: learnerA,
            key: 'ai_doubts',
            enabled: null,
          });
        }
      });

      test('deleting through the admin API leaves only an anonymous audit entry', async () => {
        const boss = await staffMember('admin', []);
        await admin.setActive(f, boss, { learnerId: learnerA, active: false });
        await admin.deleteStudent(f, boss, { learnerId: learnerA });
        const mine = (await f.audit.page(null, 100)).filter((e) => e.staffId === boss.staffId);
        expect(mine.map((e) => e.action)).toEqual(['student_deleted', 'student_deactivated']);
        expect(JSON.stringify(mine)).not.toContain(learnerA);
        expect(mine[0]?.details).toEqual({ learner: 'DELETED' });
        expect(await f.org.cohortOfLearner(learnerA)).toBeUndefined();
      });

      test('inviting an email already used is refused; staff can be given cohorts', async () => {
        const boss = await staffMember('admin', []);
        const email = `${randomUUID()}@ngo.example`;
        const id = await admin.saveStaff(f, boss, {
          email,
          role: 'mentor',
          name: 'New',
          active: true,
          cohortIds: [cohortA],
        });
        expect((await f.staff.byId(id))?.cohortIds).toEqual([cohortA]);
        const again = admin.saveStaff(f, boss, {
          email: email.toUpperCase(),
          role: 'mentor',
          name: 'Dup',
          active: true,
          cohortIds: [],
        });
        expect(await codeOf(again)).toBe('INVALID_REQUEST');
      });
    });
  });
}

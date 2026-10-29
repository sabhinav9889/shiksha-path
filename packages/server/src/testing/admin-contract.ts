import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import * as admin from '../services/admin.js';
import { listAudit } from '../services/audit.js';
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
          admin.deleteLab(f, mentor, { id: randomUUID() }),
          admin.deleteCohort(f, mentor, { id: cohortA }),
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

      test('more than 50 students page by an id cursor; "needs attention" looks past page 1', async () => {
        const boss = await staffMember('admin', []);
        const lab = await f.org.saveLab({ name: 'Lab' });
        const cohort = await f.org.saveCohort({ name: 'Big', labId: lab });
        const ids: string[] = [];
        for (let n = 0; n < 51; n += 1) ids.push(await w.learnerIn(cohort));
        const late = ids[50] ?? '';
        await f.org.renameLearner(late, 'zz-late');
        await f.summaries.refresh(late, () => ({
          lessonsDone: 0,
          lessonsThisWeek: 0,
          streak: 0,
          lastActiveDay: '2020-01-01',
          currentLesson: null,
          lowScores: false,
          stuckLesson: null,
        }));
        const first = await admin.searchStudents(f, boss, { cohortId: cohort });
        expect(first.students).toHaveLength(50);
        expect(first.next).toMatch(/^[0-9a-f-]{36}$/); // an id, never a name
        const second = await admin.searchStudents(f, boss, {
          cohortId: cohort,
          after: first.next ?? '',
        });
        expect(second.students.map((s) => s.id)).toEqual([late]);
        expect(second.next).toBeNull();
        const flagged = await admin.searchStudents(f, boss, { cohortId: cohort, attention: true });
        expect(flagged.students.map((s) => s.id)).toEqual([late]);
      });

      test('renaming and moving at once writes one audit entry, not two', async () => {
        const boss = await staffMember('admin', []);
        await admin.editStudent(f, boss, {
          learnerId: learnerA,
          name: 'New Name',
          cohortId: cohortB,
        });
        const mine = (await f.audit.page(null, 100)).filter((e) => e.staffId === boss.staffId);
        expect(mine.map((e) => e.action)).toEqual(['student_edited']);
        expect(mine[0]?.details).toEqual({ to: cohortB });
        expect((await f.org.student(learnerA))?.name).toBe('New Name');
        expect(await f.org.cohortOfLearner(learnerA)).toBe(cohortB);
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

      test('an admin pauses a mentor and changes their cohorts, but never demotes themselves', async () => {
        const boss = await staffMember('admin', []);
        const mentor = await staffMember('mentor', [cohortA]);
        const row = await f.staff.byId(mentor.staffId);
        if (!row) throw new Error('no mentor row');
        const base = { id: row.id, email: row.email, name: row.name, role: row.role };
        await admin.saveStaff(f, boss, { ...base, active: true, cohortIds: [cohortA, cohortB] });
        expect((await f.staff.byId(row.id))?.cohortIds.sort()).toEqual([cohortA, cohortB].sort());
        await admin.saveStaff(f, boss, { ...base, active: false, cohortIds: [] });
        expect((await f.staff.byId(row.id))?.active).toBe(false);

        const self = await f.staff.byId(boss.staffId);
        if (!self) throw new Error('no admin row');
        const me = { id: self.id, email: self.email, name: self.name, cohortIds: [] };
        const pause = admin.saveStaff(f, boss, { ...me, role: 'admin', active: false });
        expect(await codeOf(pause)).toBe('INVALID_REQUEST');
        const demote = admin.saveStaff(f, boss, { ...me, role: 'mentor', active: true });
        expect(await codeOf(demote)).toBe('INVALID_REQUEST');
        expect((await f.staff.byId(boss.staffId))?.role).toBe('admin');
      });

      test('a cohort with students is never deleted, even if they are paused', async () => {
        const boss = await staffMember('admin', []);
        const id = await f.org.saveCohort({ name: 'Full', labId: null });
        const student = await w.learnerIn(id);
        expect(await codeOf(admin.deleteCohort(f, boss, { id }))).toBe('NOT_EMPTY');
        await admin.setActive(f, boss, { learnerId: student, active: false });
        expect(await codeOf(admin.deleteCohort(f, boss, { id }))).toBe('NOT_EMPTY');
        expect((await f.org.cohorts([id])).map((c) => c.id)).toEqual([id]);
        const log = await listAudit(f, boss, null, 100);
        expect(log.entries.some((e) => e.details['id'] === id)).toBe(false);
      });

      test('an empty cohort is deleted and audited; its lab stays', async () => {
        const boss = await staffMember('admin', []);
        const lab = await f.org.saveLab({ name: 'Keep' });
        const id = await f.org.saveCohort({ name: 'Empty', labId: lab });
        await admin.deleteCohort(f, boss, { id });
        expect(await f.org.cohorts([id])).toEqual([]);
        expect((await f.org.labs()).map((l) => l.id)).toContain(lab);
        const entry = (await listAudit(f, boss, null, 100)).entries.find(
          (e) => e.action === 'cohort_deleted' && e.details['id'] === id,
        );
        expect(entry?.details).toEqual({ id, name: 'Empty' });
      });

      test('a lab with a cohort is refused; an empty lab is deleted and audited', async () => {
        const boss = await staffMember('admin', []);
        const lab = await f.org.saveLab({ name: 'Busy' });
        const cohort = await f.org.saveCohort({ name: 'In lab', labId: lab });
        expect(await codeOf(admin.deleteLab(f, boss, { id: lab }))).toBe('NOT_EMPTY');
        await admin.deleteCohort(f, boss, { id: cohort });
        await admin.deleteLab(f, boss, { id: lab });
        expect((await f.org.labs()).map((l) => l.id)).not.toContain(lab);
        const entry = (await listAudit(f, boss, null, 100)).entries.find(
          (e) => e.action === 'lab_deleted' && e.details['id'] === lab,
        );
        expect(entry?.details).toEqual({ id: lab, name: 'Busy' });
      });

      test('deleting something that is not there is refused and not audited', async () => {
        const boss = await staffMember('admin', []);
        const nothing = randomUUID();
        expect(await codeOf(admin.deleteCohort(f, boss, { id: nothing }))).toBe('INVALID_REQUEST');
        expect(await codeOf(admin.deleteLab(f, boss, { id: nothing }))).toBe('INVALID_REQUEST');
        const log = await listAudit(f, boss, null, 100);
        expect(log.entries.some((e) => e.details['id'] === nothing)).toBe(false);
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

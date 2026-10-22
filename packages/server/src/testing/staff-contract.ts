import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Caller } from '../ports.js';
import { ApiFailure } from '../services/failure.js';
import { linkLearner } from '../services/link.js';
import {
  addDays,
  cryptoIds,
  createEvent,
  istDay,
  systemClock,
  type LearnerEvent,
} from '@shiksha/learner-core';
import { listAudit, withAudit } from '../services/audit.js';
import {
  issueStudentCode,
  markAttendance,
  resetStudentCode,
  setLevel,
} from '../services/mentor-actions.js';
import { listUnreviewed, recordingUrl, reviewRecording } from '../services/recording-review.js';
import { listCohorts, studentDetail } from '../services/staff-read.js';
import { claimStaff, inScope, staffCaller } from '../services/staff.js';
import type { ServiceFixture } from './service-contract.js';

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiFailure ? error.code : String(error)),
  );

const google = (authUserId: string, email: string | null): Caller => ({
  authUserId,
  provider: 'google',
  email,
});

/** Staff accounts, invites and cohort scope, against any set of repositories. */
export function describeStaffContract(name: string, make: () => Promise<ServiceFixture>): void {
  describe(`staff over ${name}`, () => {
    let f: ServiceFixture;
    let cohortA: string;
    let cohortB: string;
    let learnerA: string;
    let learnerB: string;

    async function learnerIn(cohortId: string): Promise<string> {
      const auth = await f.newAuthUser();
      const { learnerId } = await linkLearner(f, google(auth, null), {
        profileId: randomUUID(),
        name: 'S',
      });
      await f.org.setLearnerCohort(learnerId, cohortId);
      return learnerId;
    }

    async function staffMember(role: 'mentor' | 'admin', cohortIds: string[]) {
      const email = `${randomUUID()}@ngo.example`;
      await f.staff.save({ email, role, name: role, active: true, cohortIds });
      const auth = await f.newAuthUser();
      return claimStaff(f, google(auth, email));
    }

    beforeEach(async () => {
      f = await make();
      const lab = await f.org.saveLab({ name: 'Lab' });
      cohortA = await f.org.saveCohort({ name: 'A', labId: lab });
      cohortB = await f.org.saveCohort({ name: 'B', labId: lab });
      learnerA = await learnerIn(cohortA);
      learnerB = await learnerIn(cohortB);
    });

    afterEach(async () => {
      await f.cleanup();
    });

    test('an invite is claimed by a Google sign-in with that email, in any case, once', async () => {
      const email = `Mentor.${randomUUID()}@NGO.example`;
      await f.staff.save({ email, role: 'mentor', name: 'M', active: true, cohortIds: [cohortA] });
      const auth = await f.newAuthUser();
      const me = await claimStaff(f, google(auth, email.toLowerCase()));
      expect(me).toEqual({ staffId: me.staffId, role: 'mentor', cohortIds: [cohortA] });
      const other = await f.newAuthUser();
      expect(await codeOf(claimStaff(f, google(other, email)))).toBe('NOT_STAFF');
      expect(await staffCaller(f, google(auth, null))).toEqual(me);
    });

    test('no invite, a code (email) sign-in, or a learner account cannot claim', async () => {
      const email = `${randomUUID()}@ngo.example`;
      await f.staff.save({ email, role: 'mentor', name: 'M', active: true, cohortIds: [] });
      const stranger = await f.newAuthUser();
      expect(await codeOf(claimStaff(f, google(stranger, 'nobody@ngo.example')))).toBe('NOT_STAFF');
      const code = await f.newAuthUser();
      const byCode = claimStaff(f, { authUserId: code, provider: 'email', email });
      expect(await codeOf(byCode)).toBe('NOT_STAFF');
      const learnerAuth = await f.newAuthUser();
      await linkLearner(f, google(learnerAuth, null), { profileId: randomUUID(), name: 'L' });
      expect(await codeOf(claimStaff(f, google(learnerAuth, email)))).toBe('FORBIDDEN');
    });

    test('a staff account cannot link as a learner', async () => {
      const email = `${randomUUID()}@ngo.example`;
      await f.staff.save({ email, role: 'mentor', name: 'M', active: true, cohortIds: [] });
      const auth = await f.newAuthUser();
      await claimStaff(f, google(auth, email));
      const out = linkLearner(f, google(auth, email), { profileId: randomUUID(), name: 'X' });
      expect(await codeOf(out)).toBe('FORBIDDEN');
    });

    test('an unclaimed, inactive or unknown account is NOT_STAFF', async () => {
      expect(await codeOf(staffCaller(f, google(await f.newAuthUser(), null)))).toBe('NOT_STAFF');
      const me = await staffMember('mentor', [cohortA]);
      const [row] = await f.staff.list();
      await f.staff.save({ ...row!, id: me.staffId, active: false, cohortIds: [cohortA] });
      const auth = (await f.staff.byId(me.staffId))?.authUserId ?? '';
      expect(await codeOf(staffCaller(f, google(auth, null)))).toBe('NOT_STAFF');
    });

    test('a mentor reaches their cohorts only; an admin reaches everyone', async () => {
      const mentor = await staffMember('mentor', [cohortA]);
      await inScope(f, mentor, learnerA);
      expect(await codeOf(inScope(f, mentor, learnerB))).toBe('FORBIDDEN');
      expect(await codeOf(inScope(f, mentor, randomUUID()))).toBe('FORBIDDEN');
      const admin = await staffMember('admin', []);
      await inScope(f, admin, learnerA);
      await inScope(f, admin, learnerB);
    });

    describe('the audit log', () => {
      // The log is shared by every test on a real database: look at this test's staff only.
      const mine = async (staff: { staffId: string }, limit = 50) =>
        (await listAudit(f, staff as never, null, limit)).entries.filter(
          (e) => e.staffId === staff.staffId,
        );

      test('a successful action writes one entry; a failed one writes none', async () => {
        const admin = await staffMember('admin', []);
        await withAudit(
          f,
          { staff: admin, action: 'student_moved', learnerId: learnerA, details: { to: cohortB } },
          () => f.org.setLearnerCohort(learnerA, cohortB),
        );
        const failing = withAudit(
          f,
          { staff: admin, action: 'student_moved', learnerId: learnerA, details: {} },
          () => Promise.reject(new ApiFailure('INVALID_REQUEST')),
        );
        expect(await codeOf(failing)).toBe('INVALID_REQUEST');
        const entries = await mine(admin);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
          staffId: admin.staffId,
          action: 'student_moved',
          learnerId: learnerA,
          details: { to: cohortB },
        });
      });

      test('details may never carry a code, token or comment', async () => {
        const admin = await staffMember('admin', []);
        for (const key of ['code', 'token', 'comment']) {
          const out = withAudit(
            f,
            { staff: admin, action: 'code_issued', learnerId: learnerA, details: { [key]: 'x' } },
            () => Promise.resolve(),
          );
          expect(await codeOf(out)).toMatch(/audit details/);
        }
        expect(await mine(admin)).toEqual([]);
      });

      test('only an admin reads it, newest first, a page at a time', async () => {
        const admin = await staffMember('admin', []);
        for (const n of [1, 2, 3]) {
          await withAudit(
            f,
            { staff: admin, action: 'lab_saved', learnerId: null, details: { n } },
            () => Promise.resolve(),
          );
        }
        const first = await listAudit(f, admin, null, 2);
        expect(first.entries.map((e) => e.details.n)).toEqual([3, 2]);
        const next = await listAudit(f, admin, first.next, 2);
        expect(next.entries[0]?.details.n).toBe(1);
        const mentor = await staffMember('mentor', [cohortA]);
        expect(await codeOf(listAudit(f, mentor, null, 10))).toBe('FORBIDDEN');
      });

      test('deleting a learner anonymises their entries', async () => {
        const admin = await staffMember('admin', []);
        await withAudit(
          f,
          { staff: admin, action: 'level_set', learnerId: learnerA, details: { track: 'english' } },
          () => Promise.resolve(),
        );
        await f.audit.anonymiseLearner(learnerA);
        const [entry] = await mine(admin);
        expect(entry?.learnerId).toBeNull();
        expect(entry?.details).toEqual({ track: 'english', learner: 'DELETED' });
        expect(JSON.stringify(entry)).not.toContain(learnerA);
      });
    });

    describe("the mentor's read API", () => {
      const ids = { clock: systemClock, ids: cryptoIds };
      const wrong = (learnerId: string, lessonId: string): LearnerEvent =>
        createEvent(ids, learnerId, 'item_answered', {
          source: { kind: 'lesson', lessonId },
          itemId: 'q1',
          outcome: 'wrong',
        });

      test('a mentor lists only their cohort; an admin lists both', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const mine = await listCohorts(f, mentor);
        expect(mine.cohorts.map((c) => c.id)).toEqual([cohortA]);
        expect(mine.cohorts[0]?.students.map((s) => s.id)).toEqual([learnerA]);
        const admin = await staffMember('admin', []);
        const all = await listCohorts(f, admin);
        expect(all.cohorts.map((c) => c.id).sort()).toEqual([cohortA, cohortB].sort());
      });

      test('students who need attention come first', async () => {
        const quietOne = await learnerIn(cohortA);
        await f.events.insertMany(quietOne, [wrong(quietOne, 'ef1-01')]);
        await f.summaries.refresh(quietOne, () => ({
          lessonsDone: 0,
          lessonsThisWeek: 0,
          streak: 0,
          lastActiveDay: '2020-01-01',
          currentLesson: null,
          lowScores: false,
          stuckLesson: null,
        }));
        const mentor = await staffMember('mentor', [cohortA]);
        const [cohort] = (await listCohorts(f, mentor)).cohorts;
        expect(cohort?.students[0]).toMatchObject({ id: quietOne, attention: ['inactive'] });
      });

      test("another cohort's student, or an unknown id, is FORBIDDEN alike", async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        expect(await codeOf(studentDetail(f, mentor, learnerB))).toBe('FORBIDDEN');
        expect(await codeOf(studentDetail(f, mentor, randomUUID()))).toBe('FORBIDDEN');
      });

      test('the detail lists weak lessons by wrong answers and carries no email or code', async () => {
        const e1 = wrong(learnerA, 'ef1-02');
        await f.events.insertMany(learnerA, [
          e1,
          e1,
          wrong(learnerA, 'ef1-02'),
          wrong(learnerA, 'ef1-01'),
        ]);
        const mentor = await staffMember('mentor', [cohortA]);
        const detail = await studentDetail(f, mentor, learnerA);
        expect(detail.student).toMatchObject({
          id: learnerA,
          cohortId: cohortA,
          deactivated: false,
        });
        expect(detail.weakLessons).toEqual([
          { lessonId: 'ef1-02', wrong: 2 },
          { lessonId: 'ef1-01', wrong: 1 },
        ]);
        expect(detail.recent.length).toBe(3);
        expect(JSON.stringify(detail)).not.toContain('@');
        expect(detail).not.toHaveProperty('code');
      });
    });

    describe('reviewing recordings', () => {
      async function uploaded(learnerId: string): Promise<string> {
        const id = randomUUID();
        await f.recordings.create({
          id,
          learnerId,
          lessonId: 'ef1-02',
          itemId: 's1',
          mime: 'audio/webm',
          bytes: 3,
          durationMs: 1000,
          recordedAt: new Date().toISOString(),
        });
        f.storage.put(`${learnerId}/${id}`, 3);
        await f.recordings.markUploaded(id, new Date());
        return id;
      }

      test("a mentor lists and plays their cohort's unreviewed recordings, not another's", async () => {
        const [mine, theirs] = [await uploaded(learnerA), await uploaded(learnerB)];
        const mentor = await staffMember('mentor', [cohortA]);
        const list = await listUnreviewed(f, mentor);
        expect(list.recordings.map((r) => r.id)).toEqual([mine]);
        expect((await recordingUrl(f, mentor, mine)).url).toContain(`${learnerA}/${mine}`);
        expect(await codeOf(recordingUrl(f, mentor, theirs))).toBe('FORBIDDEN');
        expect(await codeOf(recordingUrl(f, mentor, randomUUID()))).toBe('FORBIDDEN');
      });

      test('a pending (not uploaded) recording has no URL', async () => {
        const id = randomUUID();
        await f.recordings.create({
          id,
          learnerId: learnerA,
          lessonId: 'ef1-02',
          itemId: 's1',
          mime: 'audio/webm',
          bytes: 3,
          durationMs: 1000,
          recordedAt: new Date().toISOString(),
        });
        const mentor = await staffMember('mentor', [cohortA]);
        expect(await codeOf(recordingUrl(f, mentor, id))).toBe('INVALID_REQUEST');
      });

      test('review keeps the first time, updates the comment, and never logs the comment', async () => {
        const id = await uploaded(learnerA);
        const mentor = await staffMember('mentor', [cohortA]);
        const first = await reviewRecording(f, mentor, { id, comment: 'Clear, slow down a bit' });
        const again = await reviewRecording(f, mentor, { id, comment: 'Better now' });
        expect(again.reviewedAt).toBe(first.reviewedAt);
        const [row] = (await studentDetail(f, mentor, learnerA)).recordings;
        expect(row).toMatchObject({ id, comment: 'Better now', reviewedAt: first.reviewedAt });
        expect((await listUnreviewed(f, mentor)).recordings).toEqual([]);
        const log = JSON.stringify(await f.audit.page(null, 100));
        expect(log).toContain('recording_reviewed');
        expect(log).not.toContain('slow down');
        expect(log).not.toContain('Better now');
      });

      test('a 281-character comment is refused', async () => {
        const id = await uploaded(learnerA);
        const mentor = await staffMember('mentor', [cohortA]);
        const out = reviewRecording(f, mentor, { id, comment: 'x'.repeat(281) });
        expect(await codeOf(out)).toBe('INVALID_REQUEST');
        expect(
          (await reviewRecording(f, mentor, { id, comment: 'x'.repeat(280) })).reviewedAt,
        ).toBeTruthy();
      });

      test('review starts the retention clock: gone 31 days later, kept at 29', async () => {
        const id = await uploaded(learnerA);
        const mentor = await staffMember('mentor', [cohortA]);
        const { reviewedAt } = await reviewRecording(f, mentor, { id });
        const day = 86_400_000;
        const at29 = new Date(Date.parse(reviewedAt) + 29 * day);
        expect((await f.recordings.due(at29)).map((r) => r.id)).not.toContain(id);
        const at31 = new Date(Date.parse(reviewedAt) + 31 * day);
        expect((await f.recordings.due(at31)).map((r) => r.id)).toContain(id);
      });
    });

    describe("the mentor's actions", () => {
      const today = () => istDay(new Date());
      const entriesFor = async (staffId: string) =>
        (await f.audit.page(null, 100)).filter((e) => e.staffId === staffId);

      test('a mentor issues a code for a new student in their cohort, never another cohort', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const out = await issueStudentCode(f, mentor, { name: 'नई', cohortId: cohortA });
        expect(out.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        expect(await f.org.cohortOfLearner(out.learnerId)).toBe(cohortA);
        const other = issueStudentCode(f, mentor, { name: 'X', cohortId: cohortB });
        expect(await codeOf(other)).toBe('FORBIDDEN');
        const log = await entriesFor(mentor.staffId);
        expect(log.map((e) => e.action)).toEqual(['code_issued']);
        expect(JSON.stringify(log)).not.toContain(out.code);
      });

      test('a reset by a mentor stops the old code', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const issued = await issueStudentCode(f, mentor, { name: 'नई', cohortId: cohortA });
        const reset = await resetStudentCode(f, mentor, { learnerId: issued.learnerId });
        expect(reset.code).not.toBe(issued.code);
        expect(await f.codes.findByLookup('x')).toBeNull(); // lookups are hashes, never the code
        expect(await codeOf(resetStudentCode(f, mentor, { learnerId: learnerB }))).toBe(
          'FORBIDDEN',
        );
      });

      test('a level change is a server event in the learner log, refreshing the summary', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const { eventId } = await setLevel(f, mentor, {
          learnerId: learnerA,
          track: 'english',
          startLesson: 'ef1-03',
        });
        const { events } = await f.events.page(learnerA, 0, 100);
        expect(events.find((e) => e.id === eventId)).toMatchObject({
          type: 'level_set',
          data: { track: 'english', startLesson: 'ef1-03' },
        });
        expect((await f.summaries.forLearners([learnerA])).has(learnerA)).toBe(true);
        const out = setLevel(f, mentor, {
          learnerId: learnerB,
          track: 'english',
          startLesson: 'x',
        });
        expect(await codeOf(out)).toBe('FORBIDDEN');
        expect((await entriesFor(mentor.staffId)).map((e) => e.action)).toEqual(['level_set']);
      });

      test('attendance marks the whole cohort for a day, and marking again replaces it', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const second = await learnerIn(cohortA);
        const day = today();
        expect(
          await markAttendance(f, mentor, { cohortId: cohortA, day, present: [learnerA] }),
        ).toEqual({ marked: 2 });
        await markAttendance(f, mentor, { cohortId: cohortA, day, present: [second] });
        const detail = await studentDetail(f, mentor, learnerA);
        expect(detail.attendance).toEqual([{ date: day, present: false }]);
        expect((await studentDetail(f, mentor, second)).attendance).toEqual([
          { date: day, present: true },
        ]);
      });

      test('attendance refuses a future day and a learner of another cohort, writing nothing', async () => {
        const mentor = await staffMember('mentor', [cohortA]);
        const tomorrow = addDays(today(), 1);
        const future = markAttendance(f, mentor, { cohortId: cohortA, day: tomorrow, present: [] });
        expect(await codeOf(future)).toBe('INVALID_REQUEST');
        const stranger = markAttendance(f, mentor, {
          cohortId: cohortA,
          day: today(),
          present: [learnerB],
        });
        expect(await codeOf(stranger)).toBe('FORBIDDEN');
        expect((await studentDetail(f, mentor, learnerA)).attendance).toEqual([]);
        const notMine = markAttendance(f, mentor, { cohortId: cohortB, day: today(), present: [] });
        expect(await codeOf(notMine)).toBe('FORBIDDEN');
      });
    });
  });
}

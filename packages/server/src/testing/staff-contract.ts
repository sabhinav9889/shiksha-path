import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Caller } from '../ports.js';
import { ApiFailure } from '../services/failure.js';
import { linkLearner } from '../services/link.js';
import { listAudit, withAudit } from '../services/audit.js';
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
  });
}

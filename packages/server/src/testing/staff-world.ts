import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach } from 'vitest';
import type { Caller } from '../ports.js';
import { ApiFailure } from '../services/failure.js';
import { linkLearner } from '../services/link.js';
import { claimStaff, type StaffCaller } from '../services/staff.js';
import type { ServiceFixture } from './service-contract.js';

/** The error code a promise fails with, or undefined when it succeeds. */
export const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiFailure ? error.code : String(error)),
  );

export const google = (authUserId: string, email: string | null): Caller => ({
  authUserId,
  provider: 'google',
  email,
});

export interface StaffWorld {
  f: ServiceFixture;
  cohortA: string;
  cohortB: string;
  learnerA: string;
  learnerB: string;
  learnerAuth(learnerId: string): Promise<string>;
  learnerIn(cohortId: string): Promise<string>;
  staffMember(role: 'mentor' | 'admin', cohortIds: string[]): Promise<StaffCaller>;
}

/** Two cohorts in one lab with a learner in each, fresh for every test of the calling describe. */
export function staffWorld(make: () => Promise<ServiceFixture>): StaffWorld {
  const authOf = new Map<string, string>();
  const w = {
    learnerAuth: (learnerId: string): Promise<string> =>
      Promise.resolve(authOf.get(learnerId) ?? ''),
    async learnerIn(cohortId: string): Promise<string> {
      const auth = await w.f.newAuthUser();
      const { learnerId } = await linkLearner(w.f, google(auth, null), {
        profileId: randomUUID(),
        name: 'S',
      });
      await w.f.org.setLearnerCohort(learnerId, cohortId);
      authOf.set(learnerId, auth);
      return learnerId;
    },
    async staffMember(role: 'mentor' | 'admin', cohortIds: string[]): Promise<StaffCaller> {
      const email = `${randomUUID()}@ngo.example`;
      await w.f.staff.save({ email, role, name: role, active: true, cohortIds });
      const auth = await w.f.newAuthUser();
      return claimStaff(w.f, google(auth, email));
    },
  } as StaffWorld;

  beforeEach(async () => {
    w.f = await make();
    const lab = await w.f.org.saveLab({ name: 'Lab' });
    w.cohortA = await w.f.org.saveCohort({ name: 'A', labId: lab });
    w.cohortB = await w.f.org.saveCohort({ name: 'B', labId: lab });
    w.learnerA = await w.learnerIn(w.cohortA);
    w.learnerB = await w.learnerIn(w.cohortB);
  });

  afterEach(async () => {
    await w.f.cleanup();
  });
  return w;
}

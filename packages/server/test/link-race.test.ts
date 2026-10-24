import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import type { Caller, LearnerRepo } from '../src/ports.js';
import { linkLearner } from '../src/services/link.js';
import { makeMemoryFixture } from '../src/testing/memory-repos.js';
import { codeOf } from '../src/testing/staff-world.js';

const google = (authUserId: string): Caller => ({ authUserId, provider: 'google', email: null });

/** A repository whose first identity lookup is stale (read before the other request wrote). */
function staleOnce(real: LearnerRepo): LearnerRepo {
  let calls = 0;
  return {
    ...real,
    findByAuthUser: (id) => (calls++ === 0 ? Promise.resolve(null) : real.findByAuthUser(id)),
  };
}

describe('linking when another request for the same identity lands in between', () => {
  test('finds the learner it just lost the race to, instead of PROFILE_TAKEN', async () => {
    const f = await makeMemoryFixture();
    const auth = await f.newAuthUser();
    const body = { profileId: randomUUID(), name: 'A' };
    await linkLearner(f, google(auth), body); // the other request got there first
    const late = { ...f, learners: staleOnce(f.learners) };
    const out = await linkLearner(late, google(auth), body);
    expect(out).toEqual({ learnerId: body.profileId, name: 'A', created: false });
    await f.cleanup();
  });

  test('a different identity asking for a taken profile id is still PROFILE_TAKEN', async () => {
    const f = await makeMemoryFixture();
    const [one, two] = [await f.newAuthUser(), await f.newAuthUser()];
    const body = { profileId: randomUUID(), name: 'A' };
    await linkLearner(f, google(one), body);
    const late = { ...f, learners: staleOnce(f.learners) };
    expect(await codeOf(linkLearner(late, google(two), body))).toBe('PROFILE_TAKEN');
    await f.cleanup();
  });
});

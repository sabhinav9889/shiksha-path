import type { Session } from '@shiksha/api-contract';
import { codeLookup, codePassword } from '../codes/code-crypto.js';
import { cryptoRandom, newCode, normaliseCode } from '../codes/code-format.js';
import {
  AuthUnavailable,
  type Auth,
  type CodeAuth,
  type CodeRepo,
  type LearnerRepo,
  type RateLimiter,
  type SwitchRepo,
} from '../ports.js';
import { ApiFailure } from './failure.js';
import { enforce, refuseIfFull } from './limits.js';

export interface CodeDeps {
  learners: LearnerRepo;
  switches: SwitchRepo;
  codes: CodeRepo;
  auth: Auth & CodeAuth;
  limiter: RateLimiter;
  /** CODE_PEPPER: at least 32 characters, from the environment only. */
  pepper: string;
  random?: (n: number) => Uint8Array;
}

/** A fresh code and its auth user. The code is returned once and never stored. */
async function freshCode(
  deps: CodeDeps,
): Promise<{ code: string; lookup: string; authUserId: string; authEmail: string }> {
  const code = newCode(deps.random ?? cryptoRandom);
  const normalised = normaliseCode(code) ?? '';
  const lookup = await codeLookup(deps.pepper, normalised);
  const user = await deps.auth.createCodeUser(await codePassword(deps.pepper, normalised));
  return { code, lookup, authUserId: user.authUserId, authEmail: user.email };
}

/** Undo a just-made auth user when saving its code failed, so none is left behind. */
async function saving(
  deps: CodeDeps,
  authUserId: string,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    await deps.auth.deleteUser(authUserId);
    throw error;
  }
}

/**
 * Issue a backup code (spec §5.3): for a new student by name, or for a learner who has no
 * sign-in yet. A learner who signs in with Google gets no code.
 */
export async function issueCode(
  deps: CodeDeps,
  input: { name: string } | { learnerId: string },
): Promise<{ learnerId: string; code: string }> {
  if ('learnerId' in input) {
    const learner = await deps.learners.findById(input.learnerId);
    if (!learner || (await deps.codes.identityOf(learner.id))) {
      throw new ApiFailure('INVALID_REQUEST');
    }
  }
  const fresh = await freshCode(deps);
  const learnerId = 'learnerId' in input ? input.learnerId : crypto.randomUUID();
  const row = {
    learnerId,
    lookup: fresh.lookup,
    authUserId: fresh.authUserId,
    authEmail: fresh.authEmail,
  };
  await saving(deps, fresh.authUserId, () =>
    'name' in input
      ? deps.codes.createLearnerWithCode({ ...row, name: input.name })
      : deps.codes.addCode(row),
  );
  return { learnerId, code: fresh.code };
}

/** A new code for the learner; the old code and every session made with it stop at once. */
export async function resetCode(deps: CodeDeps, learnerId: string): Promise<{ code: string }> {
  const current = await deps.codes.forLearner(learnerId);
  if (!current) throw new ApiFailure('INVALID_REQUEST');
  const fresh = await freshCode(deps);
  await saving(deps, fresh.authUserId, () =>
    deps.codes.replace({
      learnerId,
      lookup: fresh.lookup,
      authUserId: fresh.authUserId,
      authEmail: fresh.authEmail,
    }),
  );
  await deps.auth.deleteUser(current.authUserId);
  return { code: fresh.code };
}

async function attempt(deps: CodeDeps, typed: string): Promise<Session | null> {
  const normalised = normaliseCode(typed);
  if (!normalised) return null;
  const row = await deps.codes.findByLookup(await codeLookup(deps.pepper, normalised));
  if (!row) return null;
  try {
    return await deps.auth.signInWithPassword(
      row.authEmail,
      await codePassword(deps.pepper, normalised),
    );
  } catch (error) {
    if (error instanceof AuthUnavailable) throw new ApiFailure('RATE_LIMITED'); // try later
    throw error;
  }
}

/**
 * Sign in with a code. Only wrong codes count toward the limits, so a lab of students on one
 * network all get in; but once a network (or everyone together) is at the limit, every attempt
 * is refused before the code is looked at, so a guesser learns nothing.
 */
export async function signInWithCode(
  deps: CodeDeps,
  typed: string,
  clientKey: string,
): Promise<Session> {
  const network = `code:ip:${clientKey}`;
  await refuseIfFull(deps.limiter, 'code', network);
  await refuseIfFull(deps.limiter, 'codeAll', 'code:all');
  const session = await attempt(deps, typed);
  if (session) return session;
  await enforce(deps.limiter, 'code', network);
  await enforce(deps.limiter, 'codeAll', 'code:all');
  throw new ApiFailure('BAD_CODE');
}

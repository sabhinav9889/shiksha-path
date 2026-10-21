import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { normaliseCode } from '../codes/code-format.js';
import { ApiFailure } from '../services/failure.js';
import { issueCode, resetCode, signInWithCode, type CodeDeps } from '../services/codes.js';
import { getMe } from '../services/me.js';

export interface CodeFixture {
  deps: CodeDeps;
  /** Read every column of the learner's `login_codes` row (or the memory equivalent). */
  storedRow(learnerId: string): Promise<Record<string, unknown> | null>;
  cleanup(): Promise<void>;
}

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiFailure ? error.code : String(error)),
  );

/** Backup login codes, run against any set of adapters (memory, Postgres + Supabase Auth). */
export function describeCodeContract(name: string, make: () => Promise<CodeFixture>): void {
  describe(`backup codes over ${name}`, () => {
    let f: CodeFixture;
    let KEY: string; // a fresh network per test: limits outlive a test on a real database

    beforeEach(async () => {
      f = await make();
      KEY = `client-${randomUUID()}`;
    });

    afterEach(async () => {
      await f.cleanup();
    });

    test('a new student gets a code; signing in with it reaches their learner', async () => {
      const { learnerId, code } = await issueCode(f.deps, { name: 'कोड वाली' });
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      const session = await signInWithCode(f.deps, ` ${code.toLowerCase()} `, KEY);
      const caller = await f.deps.auth.verify(session.accessToken);
      expect(caller?.provider).toBe('email');
      const me = await getMe(f.deps, caller?.authUserId ?? '');
      expect(me.learner).toEqual({ id: learnerId, name: 'कोड वाली' });
      expect(session.refreshToken).toBeTruthy();
      expect(session.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    test('a wrong code is BAD_CODE', async () => {
      await issueCode(f.deps, { name: 'A' });
      expect(await codeOf(signInWithCode(f.deps, 'ABCD-EFGH', KEY))).toBe('BAD_CODE');
      expect(await codeOf(signInWithCode(f.deps, 'not a code', KEY))).toBe('BAD_CODE');
    });

    test('the 11th try from one network in 15 minutes is refused, even with the right code', async () => {
      const { code } = await issueCode(f.deps, { name: 'A' });
      for (let n = 0; n < 10; n += 1) await codeOf(signInWithCode(f.deps, 'ABCD-EFGH', KEY));
      expect(await codeOf(signInWithCode(f.deps, code, KEY))).toBe('RATE_LIMITED');
      expect((await signInWithCode(f.deps, code, 'another-network')).accessToken).toBeTruthy();
    });

    test('after a reset the old code fails and its sessions stop at once', async () => {
      const { learnerId, code } = await issueCode(f.deps, { name: 'A' });
      const before = await signInWithCode(f.deps, code, KEY);
      const { code: fresh } = await resetCode(f.deps, learnerId);
      expect(fresh).not.toBe(code);
      expect(await codeOf(signInWithCode(f.deps, code, KEY))).toBe('BAD_CODE');
      expect(await f.deps.auth.verify(before.accessToken)).toBeNull();
      const after = await signInWithCode(f.deps, fresh, KEY);
      const caller = await f.deps.auth.verify(after.accessToken);
      expect((await getMe(f.deps, caller?.authUserId ?? '')).learner.id).toBe(learnerId);
    });

    test('the code itself is never stored', async () => {
      const { learnerId, code } = await issueCode(f.deps, { name: 'A' });
      const row = JSON.stringify(await f.storedRow(learnerId));
      expect(row).not.toContain(code);
      expect(row).not.toContain(normaliseCode(code) ?? 'never');
    });

    test('resetting a learner with no code, or coding a learner that has one, is refused', async () => {
      expect(await codeOf(resetCode(f.deps, randomUUID()))).toBe('INVALID_REQUEST');
      const { learnerId } = await issueCode(f.deps, { name: 'A' });
      expect(await codeOf(issueCode(f.deps, { learnerId }))).toBe('INVALID_REQUEST');
    });
  });
}

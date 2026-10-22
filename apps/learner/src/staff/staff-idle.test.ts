import { describe, expect, test } from 'vitest';
import { idleGuard, STAFF_IDLE_MS } from './staff-idle.js';

function setup(token: string | null = 'staff-token') {
  let now = 1_000_000;
  const stored = new Map<string, string>();
  let signedOut = 0;
  const guard = idleGuard({
    token: () => Promise.resolve(signedOut > 0 ? null : token),
    signOut: () => {
      signedOut += 1;
      return Promise.resolve();
    },
    now: () => now,
    store: {
      getItem: (k) => stored.get(k) ?? null,
      setItem: (k, v) => void stored.set(k, v),
      removeItem: (k) => void stored.delete(k),
    },
  });
  return {
    guard,
    wait: (ms: number) => (now += ms),
    signedOut: () => signedOut,
  };
}

describe('the staff idle guard', () => {
  test('is 30 minutes', () => {
    expect(STAFF_IDLE_MS).toBe(30 * 60 * 1000);
  });

  test('a session in use stays signed in', async () => {
    const s = setup();
    s.guard.touch();
    for (let n = 0; n < 6; n += 1) {
      s.wait(20 * 60 * 1000);
      expect(await s.guard.token()).toBe('staff-token');
    }
    expect(s.signedOut()).toBe(0);
  });

  test('a session left alone for over 30 minutes is signed out', async () => {
    const s = setup();
    s.guard.touch();
    s.wait(STAFF_IDLE_MS + 1);
    expect(await s.guard.token()).toBeNull();
    expect(s.signedOut()).toBe(1);
  });

  test('a session with no record of use (from before this guard) is signed out', async () => {
    const s = setup();
    expect(await s.guard.token()).toBeNull();
    expect(s.signedOut()).toBe(1);
  });

  test('no session is simply no token', async () => {
    const s = setup(null);
    expect(await s.guard.token()).toBeNull();
    expect(s.signedOut()).toBe(0);
  });
});

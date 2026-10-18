import { beforeEach, describe, expect, test } from 'vitest';
import type { CoreError } from '../src/errors.js';
import { sha256Hex } from '../src/download.js';
import { PIN_PBKDF2_ITERATIONS, createProfile, verifyPin, type Profile } from '../src/profiles.js';
import {
  MemoryProfileStore,
  describeProfileStore,
  fixedClock,
  sequentialIds,
} from '../src/testing/index.js';

describeProfileStore('MemoryProfileStore', () => new MemoryProfileStore());

const FAST = 1000; // PBKDF2 iterations in tests
let store: MemoryProfileStore;
let clock: ReturnType<typeof fixedClock>;
let ids: ReturnType<typeof sequentialIds>;

beforeEach(() => {
  store = new MemoryProfileStore();
  clock = fixedClock('2026-10-18T10:00:00Z');
  ids = sequentialIds();
});

const make = (name = 'Priya', pin = '4821'): Promise<Profile> =>
  createProfile({ name, pin }, { store, ids, clock, iterations: FAST });
const verify = (id: string, pin: string): Promise<Profile> => verifyPin(id, pin, { store, clock });

const failure = async (promise: Promise<unknown>): Promise<CoreError | undefined> =>
  promise.then(
    () => undefined,
    (error: CoreError) => error,
  );
const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  (await failure(promise))?.code;

describe('createProfile', () => {
  test('stores a profile with a salted hash, not the PIN', async () => {
    const profile = await make();
    expect(profile).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Priya',
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: '2026-10-18T10:00:00.000Z',
    });
    expect(profile.pin.iterations).toBe(FAST);
    expect(await store.get(profile.id)).toEqual(profile);
    const stored = JSON.stringify(await store.list());
    const hex = await sha256Hex(new TextEncoder().encode('4821'));
    expect(stored).not.toContain('4821');
    expect(stored).not.toContain(hex);
    expect(stored).not.toContain(btoa('4821'));
  });

  test('the same PIN gets a different salt and hash for each profile', async () => {
    const [a, b] = [await make('A'), await make('B')];
    expect(a.pin.salt).not.toBe(b.pin.salt);
    expect(a.pin.hash).not.toBe(b.pin.hash);
  });

  test('uses 100,000 PBKDF2 iterations unless a test injects fewer', async () => {
    expect(PIN_PBKDF2_ITERATIONS).toBe(100_000);
    const profile = await createProfile({ name: 'Real', pin: '1234' }, { store, ids, clock });
    expect(profile.pin.iterations).toBe(PIN_PBKDF2_ITERATIONS);
    expect((await verify(profile.id, '1234')).id).toBe(profile.id);
  });

  test('trims and composes the name', async () => {
    const decomposed = String.fromCodePoint(0x0915, 0x093c);
    expect((await make(`  ${decomposed}  `)).name).toBe(decomposed.normalize('NFC'));
  });

  test.each([
    ['empty', ''],
    ['blank', '   '],
    ['41 characters', 'a'.repeat(41)],
    ['a control character', `a${String.fromCodePoint(7)}b`],
  ])('rejects a name that is %s', async (_label, name) => {
    expect(await codeOf(make(name))).toBe('NAME_INVALID');
    expect(await store.list()).toEqual([]);
  });

  test('accepts a 40-character Hindi name', async () => {
    const name = String.fromCodePoint(0x0905).repeat(40);
    expect((await make(name)).name).toBe(name);
  });

  test.each(['123', '12345', 'abcd', '12 4', '', '１２３４'])('rejects the PIN %j', async (pin) => {
    expect(await codeOf(make('Priya', pin))).toBe('PIN_INVALID');
    expect(await store.list()).toEqual([]);
  });
});

describe('verifyPin', () => {
  test('a correct PIN returns the profile', async () => {
    const profile = await make();
    expect((await verify(profile.id, '4821')).id).toBe(profile.id);
  });

  test('an unknown profile is PROFILE_NOT_FOUND', async () => {
    expect(await codeOf(verify('missing', '4821'))).toBe('PROFILE_NOT_FOUND');
  });

  test('wrong PINs count down the attempts left, then lock for 30 seconds', async () => {
    const { id } = await make();
    for (const left of [4, 3, 2, 1]) {
      const error = await failure(verify(id, '0000'));
      expect([error?.code, error?.details]).toEqual(['PIN_WRONG', { attemptsLeft: left }]);
    }
    const locked = await failure(verify(id, '0000'));
    expect([locked?.code, locked?.details]).toEqual(['PIN_LOCKED', { retryAfterSec: 30 }]);
  });

  async function lockOnce(id: string): Promise<void> {
    for (let i = 0; i < 5; i += 1) await failure(verify(id, '0000'));
  }

  test('the correct PIN is refused while locked, then works after 30 seconds and resets', async () => {
    const { id } = await make();
    await lockOnce(id);
    clock.advanceMs(10_000);
    const early = await failure(verify(id, '4821'));
    expect([early?.code, early?.details]).toEqual(['PIN_LOCKED', { retryAfterSec: 20 }]);
    clock.advanceMs(20_000);
    expect((await verify(id, '4821')).failedAttempts).toBe(0);
    const again = await failure(verify(id, '0000'));
    expect(again?.details).toEqual({ attemptsLeft: 4 });
  });

  test('a wrong PIN after a lock expired locks for twice as long, up to 900 seconds', async () => {
    const { id } = await make();
    await lockOnce(id);
    const seen: unknown[] = [];
    for (let i = 0; i < 7; i += 1) {
      clock.advanceMs(1_000_000);
      const error = await failure(verify(id, '0000'));
      seen.push((error?.details as { retryAfterSec: number }).retryAfterSec);
    }
    expect(seen).toEqual([60, 120, 240, 480, 900, 900, 900]);
  });

  test('the lock lives in the stored profile, so a restart does not clear it', async () => {
    const { id } = await make();
    await lockOnce(id);
    const afterRestart = { store, clock };
    expect(await codeOf(verifyPin(id, '4821', afterRestart))).toBe('PIN_LOCKED');
    expect((await store.get(id))?.lockedUntil).toBe('2026-10-18T10:00:30.000Z');
  });

  test('a wrong PIN while locked changes nothing', async () => {
    const { id } = await make();
    await lockOnce(id);
    const before = await store.get(id);
    await failure(verify(id, '1111'));
    expect(await store.get(id)).toEqual(before);
  });
});

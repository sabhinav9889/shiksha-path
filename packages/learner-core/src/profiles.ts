import { CoreError } from './errors.js';
import type { Clock, Ids } from './ports.js';

export const PIN_PBKDF2_ITERATIONS = 100_000;

const PIN_PATTERN = /^[0-9]{4}$/;
const NAME_MAX_CHARACTERS = 40;
const CONTROL_CHARACTER = /\p{Cc}/u;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const MS_PER_SECOND = 1000;
const WRONG_BEFORE_LOCK = 5;
const LOCK_BASE_SECONDS = 30;
const LOCK_MAX_SECONDS = 900;

export interface Profile {
  /** The `learnerId` used in events. */
  id: string;
  name: string;
  /** Salt and hash are base64. */
  pin: { salt: string; hash: string; iterations: number };
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

export interface ProfileStore {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | null>;
  put(profile: Profile): Promise<void>;
  delete(id: string): Promise<void>;
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function hashPin(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const params = { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations };
  return new Uint8Array(await crypto.subtle.deriveBits(params, key, HASH_BITS));
}

/** Compares every byte whatever the content, so timing does not reveal how much matched. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return difference === 0;
}

function cleanName(raw: string): string {
  const name = raw.normalize('NFC').trim();
  const tooLong = [...name].length > NAME_MAX_CHARACTERS;
  if (name === '' || tooLong || CONTROL_CHARACTER.test(name)) {
    throw new CoreError('NAME_INVALID', 'the name must be 1 to 40 visible characters');
  }
  return name;
}

export async function createProfile(
  input: { name: string; pin: string },
  deps: { store: ProfileStore; ids: Ids; clock: Clock; iterations?: number },
): Promise<Profile> {
  const name = cleanName(input.name);
  if (!PIN_PATTERN.test(input.pin)) {
    throw new CoreError('PIN_INVALID', 'the PIN must be exactly four digits');
  }
  const iterations = deps.iterations ?? PIN_PBKDF2_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await hashPin(input.pin, salt, iterations);
  const profile: Profile = {
    id: deps.ids.uuid(),
    name,
    pin: { salt: toBase64(salt), hash: toBase64(hash), iterations },
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: deps.clock.now().toISOString(),
  };
  await deps.store.put(profile);
  return profile;
}

const lockSeconds = (failedAttempts: number): number =>
  Math.min(LOCK_BASE_SECONDS * 2 ** (failedAttempts - WRONG_BEFORE_LOCK), LOCK_MAX_SECONDS);

/** A lock longer than the longest possible one was set under a wrong clock: ignore it. */
function isLocked(profile: Profile, now: Date): profile is Profile & { lockedUntil: string } {
  if (profile.lockedUntil === null) return false;
  const remainingMs = new Date(profile.lockedUntil).getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= LOCK_MAX_SECONDS * MS_PER_SECOND;
}

const secondsUntil = (until: string, now: Date): number =>
  Math.ceil((new Date(until).getTime() - now.getTime()) / MS_PER_SECOND);

async function recordWrongPin(
  profile: Profile,
  deps: { store: ProfileStore; clock: Clock },
): Promise<never> {
  const now = deps.clock.now();
  const failedAttempts = profile.failedAttempts + 1;
  const locks = failedAttempts >= WRONG_BEFORE_LOCK;
  const seconds = lockSeconds(failedAttempts);
  const lockedUntil = locks
    ? new Date(now.getTime() + seconds * MS_PER_SECOND).toISOString()
    : null;
  await deps.store.put({ ...profile, failedAttempts, lockedUntil });
  if (locks) throw new CoreError('PIN_LOCKED', 'too many wrong PINs', { retryAfterSec: seconds });
  throw new CoreError('PIN_WRONG', 'wrong PIN', {
    attemptsLeft: WRONG_BEFORE_LOCK - failedAttempts,
  });
}

/**
 * Check a PIN. The lockout (5 wrong in a row, then 30 s doubling to 15 min) is kept in the stored
 * profile, so it survives a restart. While locked the PIN is not even checked.
 */
export async function verifyPin(
  profileId: string,
  pin: string,
  deps: { store: ProfileStore; clock: Clock },
): Promise<Profile> {
  const profile = await deps.store.get(profileId);
  if (!profile) throw new CoreError('PROFILE_NOT_FOUND', 'no such profile on this phone');
  const now = deps.clock.now();
  if (isLocked(profile, now)) {
    const retryAfterSec = secondsUntil(profile.lockedUntil, now);
    throw new CoreError('PIN_LOCKED', 'too many wrong PINs', { retryAfterSec });
  }
  const expected = fromBase64(profile.pin.hash);
  const actual = await hashPin(pin, fromBase64(profile.pin.salt), profile.pin.iterations);
  if (!sameBytes(expected, actual)) return recordWrongPin(profile, deps);
  const cleared = { ...profile, failedAttempts: 0, lockedUntil: null };
  await deps.store.put(cleared);
  return cleared;
}

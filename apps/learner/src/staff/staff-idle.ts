// Phones are shared: a staff session left open on one must not stay open for the next child.

/** A staff session unused for this long is signed out (spec §2: shared phones). */
const IDLE_MINUTES = 30;
const MS_PER_MINUTE = 60_000;
export const STAFF_IDLE_MS = IDLE_MINUTES * MS_PER_MINUTE;
const LAST_USED = 'shiksha.staff-last-used';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface IdleGuard {
  /** The session's token, or null after signing out a session idle too long. */
  token(): Promise<string | null>;
  /** Mark the session as used now (after a sign-in). */
  touch(): void;
  forget(): void;
}

export function idleGuard(deps: {
  token: () => Promise<string | null>;
  signOut: () => Promise<void>;
  now: () => number;
  store: Store;
}): IdleGuard {
  const touch = (): void => deps.store.setItem(LAST_USED, String(deps.now()));
  const forget = (): void => deps.store.removeItem(LAST_USED);
  return {
    async token() {
      const token = await deps.token();
      if (!token) return null;
      const last = Number(deps.store.getItem(LAST_USED) ?? 0);
      if (!last || deps.now() - last > STAFF_IDLE_MS) {
        await deps.signOut();
        forget();
        return null;
      }
      touch();
      return token;
    },
    touch,
    forget,
  };
}

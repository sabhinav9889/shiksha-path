// Staff Google sign-in (Plan 4a): its own session, kept apart from every learner profile.
import { createClient } from '@supabase/supabase-js';
import type { ShikshaDb } from '../storage/db.js';
import { IdbAuthStorage } from '../api/auth-storage.js';
import { createStaffApi, type StaffApi } from './staff-api.js';
import { idleGuard } from './staff-idle.js';

const MARK = 'shiksha.staff-signin';
const STAFF_KEY = 'staff'; // session rows are stored as `staff:<name>` in the auth table
const REFRESH_MARGIN_MS = 60_000;

export interface StaffAuth {
  /** Go to Google. In the app the browser leaves; it comes back to `#/staff`. */
  startSignIn(): Promise<void>;
  /** Finish a sign-in that came back (the `code` in the URL); false when there was none. */
  finish(url: string): Promise<boolean>;
  token(): Promise<string | null>;
  signOut(): Promise<void>;
  api: StaffApi;
}

/** The staff section's own Supabase client, and its current token (refreshed when near expiry). */
function staffClient(deps: { db: ShikshaDb; supabaseUrl: string; anonKey: string }) {
  const client = createClient(deps.supabaseUrl, deps.anonKey, {
    auth: {
      flowType: 'pkce',
      storage: new IdbAuthStorage(deps.db, STAFF_KEY),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  async function sessionToken(): Promise<string | null> {
    const { data } = await client.auth.getSession();
    if (!data.session) return null;
    if ((data.session.expires_at ?? 0) * 1000 > Date.now() + REFRESH_MARGIN_MS) {
      return data.session.access_token;
    }
    return (await client.auth.refreshSession()).data.session?.access_token ?? null;
  }
  return { client, sessionToken };
}

export function createStaffAuth(deps: {
  db: ShikshaDb;
  supabaseUrl: string;
  anonKey: string;
  baseUrl: string;
}): StaffAuth {
  const { client, sessionToken } = staffClient(deps);
  const signOut = async (): Promise<void> => {
    await client.auth.signOut({ scope: 'local' });
  };
  const guard = idleGuard({
    token: sessionToken,
    signOut,
    now: Date.now,
    store: safeLocalStorage(),
  });
  const token = guard.token;
  return {
    async startSignIn() {
      sessionStorage.setItem(MARK, '1');
      await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/#/staff`,
          scopes: 'email profile',
          queryParams: { prompt: 'select_account' },
        },
      });
    },
    async finish(url) {
      if (sessionStorage.getItem(MARK) !== '1') return false;
      sessionStorage.removeItem(MARK);
      const code = new URL(url).searchParams.get('code');
      if (code) await client.auth.exchangeCodeForSession(code);
      if ((await sessionToken()) === null) return false;
      guard.touch();
      return true;
    },
    token,
    async signOut() {
      guard.forget();
      await signOut();
    },
    api: createStaffApi({ baseUrl: deps.baseUrl, token }),
  };
}

/** localStorage, or a memory stand-in where the browser refuses it (then idle time resets). */
function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    localStorage.getItem('probe');
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    };
  }
}

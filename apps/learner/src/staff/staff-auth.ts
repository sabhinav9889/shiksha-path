// Staff Google sign-in (Plan 4a): its own session, kept apart from every learner profile.
import { createClient } from '@supabase/supabase-js';
import type { ShikshaDb } from '../storage/db.js';
import { IdbAuthStorage } from '../api/auth-storage.js';
import { createStaffApi, type StaffApi } from './staff-api.js';

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

export function createStaffAuth(deps: {
  db: ShikshaDb;
  supabaseUrl: string;
  anonKey: string;
  baseUrl: string;
}): StaffAuth {
  const client = createClient(deps.supabaseUrl, deps.anonKey, {
    auth: {
      flowType: 'pkce',
      storage: new IdbAuthStorage(deps.db, STAFF_KEY),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  async function token(): Promise<string | null> {
    const { data } = await client.auth.getSession();
    if (!data.session) return null;
    if ((data.session.expires_at ?? 0) * 1000 > Date.now() + REFRESH_MARGIN_MS) {
      return data.session.access_token;
    }
    return (await client.auth.refreshSession()).data.session?.access_token ?? null;
  }
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
      return (await token()) !== null;
    },
    token,
    async signOut() {
      await client.auth.signOut({ scope: 'local' });
    },
    api: createStaffApi({ baseUrl: deps.baseUrl, token }),
  };
}

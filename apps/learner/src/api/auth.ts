// Loaded only when a learner links or restores (dynamic import), to keep first load small.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ShikshaDb } from '../storage/db.js';
import { IdbAuthStorage } from './auth-storage.js';

const LINKING_KEY = 'shiksha.linking';
/** Refresh a little before expiry, so a token never runs out mid-request. */
const REFRESH_MARGIN_MS = 60_000;

interface AuthDeps {
  db: ShikshaDb;
  supabaseUrl: string;
  anonKey: string;
}

function makeClients(deps: AuthDeps): (profileId: string) => SupabaseClient {
  const clients = new Map<string, SupabaseClient>();
  return (profileId) => {
    const existing = clients.get(profileId);
    if (existing) return existing;
    const client = createClient(deps.supabaseUrl, deps.anonKey, {
      auth: {
        flowType: 'pkce',
        storage: new IdbAuthStorage(deps.db, profileId),
        persistSession: true,
        autoRefreshToken: false, // refreshed on demand in accessToken()
        detectSessionInUrl: false,
      },
    });
    clients.set(profileId, client);
    return client;
  };
}

export interface GoogleAuth {
  startGoogleSignIn(profileId: string): Promise<void>;
  finishGoogleSignIn(url: string): Promise<{ profileId: string } | null>;
  accessToken(profileId: string): Promise<string | null>;
  signOutGoogle(profileId: string): Promise<void>;
  /** Carry a profile's sign-in session over to another profile id (after taking over a learner). */
  moveSession(fromProfileId: string, toProfileId: string): Promise<void>;
}

/** Google sign-in through Supabase Auth with PKCE; one session per phone profile. */
export function createGoogleAuth(deps: AuthDeps): GoogleAuth {
  const clientFor = makeClients(deps);

  return {
    async startGoogleSignIn(profileId) {
      sessionStorage.setItem(LINKING_KEY, profileId);
      await clientFor(profileId).auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/#/auth-callback`,
          scopes: 'email profile',
          // On a shared phone Google may remember another learner: always let them choose.
          queryParams: { prompt: 'select_account' },
        },
      });
    },
    async finishGoogleSignIn(url) {
      const profileId = sessionStorage.getItem(LINKING_KEY);
      if (!profileId) return null;
      const code = new URL(url).searchParams.get('code');
      const client = clientFor(profileId);
      if (code) await client.auth.exchangeCodeForSession(code);
      const { data } = await client.auth.getSession();
      if (!data.session) return null;
      sessionStorage.removeItem(LINKING_KEY);
      return { profileId };
    },
    async accessToken(profileId) {
      const client = clientFor(profileId);
      const { data } = await client.auth.getSession();
      if (!data.session) return null;
      const expiresAt = (data.session.expires_at ?? 0) * 1000;
      if (expiresAt > Date.now() + REFRESH_MARGIN_MS) return data.session.access_token;
      const refreshed = await client.auth.refreshSession();
      return refreshed.data.session?.access_token ?? null;
    },
    async signOutGoogle(profileId) {
      await clientFor(profileId).auth.signOut({ scope: 'local' });
    },
    async moveSession(fromProfileId, toProfileId) {
      const rows = await deps.db.auth.where('key').startsWith(`${fromProfileId}:`).toArray();
      for (const row of rows) {
        const name = row.key.slice(fromProfileId.length + 1);
        await deps.db.auth.put({ key: `${toProfileId}:${name}`, value: row.value });
        await deps.db.auth.delete(row.key);
      }
    },
  };
}

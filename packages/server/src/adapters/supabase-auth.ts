import { createClient } from '@supabase/supabase-js';
import type { Auth, CodeAuth } from '../ports.js';

const NO_SESSION = { persistSession: false, autoRefreshToken: false } as const;
const NOT_FOUND = 404;

/**
 * Supabase Auth: verifies access tokens (which also catches revoked and deleted users), and makes
 * and signs in the email users behind backup codes, with the service role, inside the API only.
 */
export function createSupabaseAuth(url: string, serviceRoleKey: string): Auth & CodeAuth {
  const client = createClient(url, serviceRoleKey, { auth: NO_SESSION });
  return {
    async verify(accessToken) {
      try {
        const { data, error } = await client.auth.getUser(accessToken);
        if (error || !data.user) return null;
        // `app_metadata` is set by Supabase and the admin API only; users cannot change it.
        const provider = String(data.user.app_metadata.provider ?? 'unknown');
        return { authUserId: data.user.id, provider };
      } catch {
        return null;
      }
    },
    async createCodeUser(password) {
      const email = `code-${crypto.randomUUID()}@codes.invalid`;
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error('could not create a code user');
      return { authUserId: data.user.id, email };
    },
    async deleteUser(authUserId) {
      const { error } = await client.auth.admin.deleteUser(authUserId);
      if (error && error.status !== NOT_FOUND) throw new Error('could not delete a user');
    },
    async signInWithPassword(email, password) {
      // A fresh client each time, so no session is kept in the API between requests.
      const signer = createClient(url, serviceRoleKey, { auth: NO_SESSION });
      const { data, error } = await signer.auth.signInWithPassword({ email, password });
      if (error || !data.session) return null;
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? 0,
      };
    },
  };
}

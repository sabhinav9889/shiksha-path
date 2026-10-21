import { createClient } from '@supabase/supabase-js';
import type { Auth } from '../ports.js';

/** Verifies access tokens with Supabase Auth, which also catches revoked and deleted users. */
export function createSupabaseAuth(url: string, serviceRoleKey: string): Auth {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  };
}

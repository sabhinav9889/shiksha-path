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
        return error || !data.user ? null : { authUserId: data.user.id };
      } catch {
        return null;
      }
    },
  };
}

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface Stack {
  apiUrl: string;
  anonKey: string;
  serviceKey: string;
  functionsUrl: string;
}

let cached: Stack | null = null;

/** Addresses and keys of the running local stack, read from the CLI (never from a file). */
export function localStack(): Stack {
  if (cached) return cached;
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
  const env = Object.fromEntries(
    [...out.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1] ?? '', m[2] ?? '']),
  );
  const apiUrl = env.API_URL ?? 'http://127.0.0.1:54321';
  cached = {
    apiUrl,
    anonKey: env.ANON_KEY ?? '',
    serviceKey: env.SERVICE_ROLE_KEY ?? '',
    functionsUrl: `${apiUrl}/functions/v1/api`,
  };
  return cached;
}

const admin = () =>
  createClient(localStack().apiUrl, localStack().serviceKey, { auth: { persistSession: false } });

/**
 * A confirmed local test user and its token. It stands in for a Google account (`provider:
 * google`, set by the admin API, which only the server can do); `email` makes a plain email user.
 */
export async function makeUser(
  provider: 'google' | 'email' = 'google',
): Promise<{ id: string; accessToken: string }> {
  const email = `${randomUUID()}@test.local`;
  const password = `pw-${randomUUID()}`;
  const app_metadata = provider === 'google' ? { provider } : {};
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata,
  });
  if (created.error || !created.data.user) throw new Error('could not create a test user');
  const client = createClient(localStack().apiUrl, localStack().anonKey, {
    auth: { persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error('could not sign in');
  return { id: created.data.user.id, accessToken: signedIn.data.session.access_token };
}

export async function deleteUser(id: string): Promise<void> {
  await admin().auth.admin.deleteUser(id);
}

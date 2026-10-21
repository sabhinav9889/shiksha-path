import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

/**
 * The local Supabase stack for the backend end-to-end test. Google is replaced by an email and
 * password user (local stack only): its session is written where the app keeps sign-in sessions,
 * and the app's own callback page takes it from there. No test-only code exists in the app.
 */
export interface LocalStack {
  apiUrl: string;
  anonKey: string;
  serviceKey: string;
  dbUrl: string;
  functionsUrl: string;
}

/** Read from the CLI each run, so no key is ever written to a file. */
export function localStack(): LocalStack {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
  const env = Object.fromEntries(
    [...out.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1] ?? '', m[2] ?? '']),
  );
  const apiUrl = env.API_URL ?? 'http://127.0.0.1:54321';
  return {
    apiUrl,
    anonKey: env.ANON_KEY ?? '',
    serviceKey: env.SERVICE_ROLE_KEY ?? '',
    dbUrl: env.DB_URL ?? '',
    functionsUrl: `${apiUrl}/functions/v1/api`,
  };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** A confirmed user standing in for one Google account. */
export async function makeGoogleUser(stack: LocalStack): Promise<TestUser> {
  const admin = createClient(stack.apiUrl, stack.serviceKey, { auth: { persistSession: false } });
  const email = `${randomUUID()}@test.local`;
  const password = `pw-${randomUUID()}`;
  // `provider: google` (admin-only metadata): /v1 lets only Google sign-ins create a learner.
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: 'google' },
  });
  if (created.error || !created.data.user) throw new Error('could not create a test user');
  return { id: created.data.user.id, email, password };
}

export async function deleteGoogleUser(stack: LocalStack, user: TestUser): Promise<void> {
  const admin = createClient(stack.apiUrl, stack.serviceKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(user.id);
}

/** Sign the user in and return exactly what supabase-js stores for that session. */
async function sessionEntries(stack: LocalStack, user: TestUser): Promise<Record<string, string>> {
  const stored: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => void (stored[key] = value),
    removeItem: (key: string) => void delete stored[key],
  };
  const client = createClient(stack.apiUrl, stack.anonKey, {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword(user);
  if (error) throw new Error('could not sign the test user in');
  return stored;
}

/**
 * Let the app's "connect Google" button run, but keep the browser on the page: the request to
 * Google is answered with "204 No Content", which leaves the page where it is.
 */
export async function holdGoogleRedirect(page: Page): Promise<void> {
  await page.route('**/auth/v1/authorize**', (route) => route.fulfill({ status: 204 }));
}

/** Google "comes back": the session lands in the app's auth table, then the callback page runs. */
export async function returnFromGoogle(
  page: Page,
  stack: LocalStack,
  user: TestUser,
): Promise<void> {
  const linking = (): Promise<string | null> =>
    page.evaluate(() => sessionStorage.getItem('shiksha.linking'));
  await expect.poll(linking, { message: 'the app started a Google sign-in' }).toBeTruthy();
  const profileId = await linking();
  const entries = await sessionEntries(stack, user);
  await page.evaluate(
    async ({ id, rows }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('shiksha');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(new Error('cannot open the app database'));
      });
      const tx = db.transaction('auth', 'readwrite');
      for (const [name, value] of Object.entries(rows)) {
        tx.objectStore('auth').put({ key: `${id}:${name}`, value });
      }
      await new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
      db.close();
    },
    { id: profileId ?? '', rows: entries },
  );
  await page.goto('about:blank');
  await page.goto('/#/auth-callback');
}

/** SQL on the local database, for checking what the server holds and changing switches. */
export function database(stack: LocalStack): postgres.Sql {
  return postgres(stack.dbUrl, { max: 1 });
}

/** The server's learner id for a Google account. */
export async function learnerOf(sql: postgres.Sql, user: TestUser): Promise<string> {
  const rows = await sql<{ learner_id: string }[]>`
    select learner_id from public.learner_identities where auth_user_id = ${user.id}`;
  const id = rows[0]?.learner_id;
  if (!id) throw new Error('the account is not linked to a learner');
  return id;
}

/** Ids of the events this phone holds for a learner, read from the app's database. */
export async function phoneEventIds(page: Page, learnerId: string): Promise<string[]> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('shiksha');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new Error('cannot open the app database'));
    });
    const all = await new Promise<{ id: string; learnerId: string }[]>((resolve) => {
      const request = db.transaction('events').objectStore('events').getAll();
      request.onsuccess = () => resolve(request.result as { id: string; learnerId: string }[]);
    });
    db.close();
    return all.filter((e) => e.learnerId === id).map((e) => e.id);
  }, learnerId);
}

export async function serverEventIds(sql: postgres.Sql, learnerId: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from public.learner_events where learner_id = ${learnerId}`;
  return rows.map((r) => r.id);
}

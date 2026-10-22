import type { ApiError } from '@shiksha/api-contract';
import type { Runtime } from '../runtime/runtime.js';

/**
 * Sign a profile in with a backup code (spec §5.3). The server answers a normal session, which is
 * kept for this profile like a Google one. The code itself is never stored on the phone.
 */
export async function signInWithCode(
  runtime: Runtime,
  profileId: string,
  code: string,
): Promise<'ok' | ApiError | 'OFFLINE'> {
  const account = runtime.account;
  if (!account) return 'INTERNAL';
  try {
    const result = await account.makeApi(() => Promise.resolve(null)).codeSignIn({ code });
    if (!result.ok) return result.error;
    const auth = await account.loadAuth();
    await auth.adoptSession(profileId, result.value);
    return 'ok';
  } catch {
    return 'OFFLINE'; // the sign-in code could not load
  }
}

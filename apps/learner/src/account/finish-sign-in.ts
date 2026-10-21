import type { StringKey } from '../i18n/index.js';
import type { Runtime } from '../runtime/runtime.js';
import { linkProfile, type LinkOutcome } from './link-flow.js';
import { completeRestore, isRestoring, type RestoreOutcome } from './restore-flow.js';

type Via = 'google' | 'code';

const LINK_MESSAGES: Record<Via, Record<LinkOutcome['kind'], StringKey>> = {
  google: {
    linked: 'account.linked',
    adopted: 'account.adopted',
    elsewhere: 'account.elsewhere',
    failed: 'account.failed',
  },
  code: {
    linked: 'account.codeAdopted', // a code always belongs to a learner already
    adopted: 'account.codeAdopted',
    elsewhere: 'account.codeElsewhere',
    failed: 'account.failed',
  },
};

const RESTORE_MESSAGES: Record<RestoreOutcome['kind'], StringKey> = {
  restored: 'account.restored',
  onPhone: 'account.alreadyHere',
  none: 'account.notFound',
  failed: 'account.failed',
};

/**
 * The profile has a sign-in session (Google came back, or a code was accepted): link it, or
 * finish restoring it. Returns the message to show; never throws.
 */
export async function finishSignIn(
  runtime: Runtime,
  profileId: string,
  via: Via = 'google',
): Promise<StringKey> {
  try {
    if (await isRestoring(runtime, profileId)) {
      return RESTORE_MESSAGES[(await completeRestore(runtime, profileId)).kind];
    }
    return LINK_MESSAGES[via][(await linkProfile(runtime, profileId)).kind];
  } catch {
    return 'account.failed'; // never leave the learner on "connecting…" with no way on
  }
}

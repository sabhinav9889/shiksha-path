import type { Fetcher, PartialStore } from './download.js';
import { CoreError } from './errors.js';
import {
  fetchAudio,
  missingEntries,
  removeUnusedAudio,
  requireSpace,
  sumBytes,
  type SyncContext,
} from './install-unit.js';
import type { BundleStorage, StorageEstimator } from './storage.js';

async function storedAudio(
  id: string,
  storage: BundleStorage,
): Promise<{ path: string; sha256: string; bytes: number }[]> {
  const stored = await storage.getModule(id);
  if (!stored) throw new CoreError('MODULE_NOT_READY', `${id} is not on this phone`);
  return stored.bundle.audio;
}

/** Audio paths of the stored bundle that are not on the phone. */
export async function missingAudio(id: string, storage: BundleStorage): Promise<string[]> {
  const missing = await missingEntries(await storedAudio(id, storage), storage);
  return missing.map((entry) => entry.path);
}

/** Download only a stored module's missing audio (after an `audio: 'skip'` sync, or a repair). */
export async function fetchMissingAudio(
  id: string,
  deps: {
    baseUrl: string;
    fetcher: Fetcher;
    storage: BundleStorage;
    partials: PartialStore;
    estimator: StorageEstimator;
  },
): Promise<{ fetched: number }> {
  const missing = await missingEntries(await storedAudio(id, deps.storage), deps.storage);
  if (missing.length === 0) return { fetched: 0 };
  const ctx: SyncContext = { ...deps, audio: 'with', protectedAudio: new Set() };
  await requireSpace(ctx, sumBytes(missing));
  await fetchAudio(missing, ctx);
  return { fetched: missing.length };
}

/**
 * Remove a module's lessons and every audio file no remaining stored bundle uses. The app
 * remembers the removal and passes the id as `skipModules` so a sync does not bring it back.
 */
export async function removeModuleContent(
  id: string,
  storage: BundleStorage,
): Promise<{ removedAudio: number }> {
  await storage.removeModule(id);
  const removedAudio = await removeUnusedAudio(await storage.getManifest(), storage);
  return { removedAudio };
}

import type { AudioEntry, Manifest } from '@shiksha/content/schema';
import { downloadFile, type Fetcher, type PartialStore } from './download.js';
import { CoreError, type ErrorCode } from './errors.js';
import {
  STORAGE_SAFETY_MARGIN_BYTES,
  type BundleStorage,
  type StorageEstimator,
} from './storage.js';

export interface ContentReport {
  id: string;
  status: 'ready' | 'installed' | 'skipped' | 'failed';
  error?: ErrorCode;
  details?: Record<string, unknown>;
}

export interface SyncContext {
  baseUrl: string;
  fetcher: Fetcher;
  storage: BundleStorage;
  partials: PartialStore;
  estimator: StorageEstimator;
  audio: 'with' | 'skip';
  /** Audio of bundles being installed: kept at the end of a sync even if this install failed. */
  protectedAudio: Set<string>;
}

/** What differs between a module and the placement test: where its bundle is stored and checked. */
export interface Unit<B extends { audio: AudioEntry[] }> {
  id: string;
  version: string;
  file: { path: string; sha256: string; bytes: number };
  stored: { version: string; bundle: B } | null;
  parse(raw: unknown): B;
  matches(bundle: B): boolean;
  put(bundle: B): Promise<void>;
}

async function freeBytes(estimator: StorageEstimator): Promise<number | null> {
  try {
    const estimate = await estimator.estimate();
    return estimate ? estimate.quota - estimate.usage : null;
  } catch {
    return null; // an estimator that fails is the same as one that cannot tell
  }
}

export async function requireSpace(ctx: SyncContext, neededBytes: number): Promise<void> {
  const free = await freeBytes(ctx.estimator);
  if (free === null || free >= neededBytes + STORAGE_SAFETY_MARGIN_BYTES) return;
  throw new CoreError('LOW_STORAGE', 'not enough free space on this phone', {
    neededBytes,
    freeBytes: free,
  });
}

export async function missingEntries(
  entries: AudioEntry[],
  storage: BundleStorage,
): Promise<AudioEntry[]> {
  const missing: AudioEntry[] = [];
  for (const entry of entries) {
    if (!(await storage.hasAudio(entry.path))) missing.push(entry);
  }
  return missing;
}

async function fetchBundle<B extends { audio: AudioEntry[] }>(
  unit: Unit<B>,
  ctx: SyncContext,
): Promise<B> {
  const { path, sha256, bytes } = unit.file;
  const raw = await downloadFile(
    { url: `${ctx.baseUrl}/${path}`, sha256, bytes },
    { fetcher: ctx.fetcher, partials: ctx.partials },
  );
  let bundle: B;
  try {
    bundle = unit.parse(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    throw new CoreError('BUNDLE_CORRUPT', `${unit.id} is not a valid bundle`);
  }
  if (!unit.matches(bundle)) {
    throw new CoreError('BUNDLE_CORRUPT', `${unit.id} is not the version the manifest lists`);
  }
  return bundle;
}

export async function fetchAudio(entries: AudioEntry[], ctx: SyncContext): Promise<void> {
  for (const { path, sha256, bytes } of entries) {
    const data = await downloadFile(
      { url: `${ctx.baseUrl}/${path}`, sha256, bytes },
      { fetcher: ctx.fetcher, partials: ctx.partials },
    );
    await ctx.storage.putAudio(path, data);
  }
}

export const sumBytes = (entries: AudioEntry[]): number => entries.reduce((n, e) => n + e.bytes, 0);

async function fetchNew<B extends { audio: AudioEntry[] }>(
  unit: Unit<B>,
  ctx: SyncContext,
): Promise<B> {
  await requireSpace(ctx, unit.file.bytes);
  const bundle = await fetchBundle(unit, ctx);
  if (ctx.audio !== 'skip') for (const a of bundle.audio) ctx.protectedAudio.add(a.path);
  return bundle;
}

async function run<B extends { audio: AudioEntry[] }>(
  unit: Unit<B>,
  ctx: SyncContext,
): Promise<ContentReport> {
  const stored = unit.stored?.version === unit.version ? unit.stored.bundle : null;
  const target = stored ?? (await fetchNew(unit, ctx));
  const missing = ctx.audio === 'skip' ? [] : await missingEntries(target.audio, ctx.storage);
  if (stored && missing.length === 0) return { id: unit.id, status: 'ready' };
  await requireSpace(ctx, (stored ? 0 : unit.file.bytes) + sumBytes(missing));
  await fetchAudio(missing, ctx);
  if (!stored) await unit.put(target);
  return { id: unit.id, status: 'installed' };
}

/** Audio paths used by the stored bundles of the manifest's modules and the placement test. */
async function referencedAudio(
  manifest: Manifest | null,
  storage: BundleStorage,
): Promise<Set<string>> {
  const referenced = new Set<string>();
  for (const entry of manifest?.modules ?? []) {
    for (const a of (await storage.getModule(entry.id))?.bundle.audio ?? []) referenced.add(a.path);
  }
  for (const a of (await storage.getPlacement())?.bundle.audio ?? []) referenced.add(a.path);
  return referenced;
}

/** Delete audio no stored bundle uses (and nothing in `keep` either). Returns how many files. */
export async function removeUnusedAudio(
  manifest: Manifest | null,
  storage: BundleStorage,
  keep: ReadonlySet<string> = new Set(),
): Promise<number> {
  const used = await referencedAudio(manifest, storage);
  let removed = 0;
  for (const path of await storage.listAudio()) {
    if (used.has(path) || keep.has(path)) continue;
    await storage.removeAudio(path);
    removed += 1;
  }
  return removed;
}

/** Install or repair one module or the placement bundle. Never throws: the report says why. */
export async function installUnit<B extends { audio: AudioEntry[] }>(
  unit: Unit<B>,
  ctx: SyncContext,
): Promise<ContentReport> {
  try {
    return await run(unit, ctx);
  } catch (error) {
    if (error instanceof CoreError) {
      const report: ContentReport = { id: unit.id, status: 'failed', error: error.code };
      return error.details ? { ...report, details: error.details } : report;
    }
    return { id: unit.id, status: 'failed', error: 'DOWNLOAD_FAILED' };
  }
}

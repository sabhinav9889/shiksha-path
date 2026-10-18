import {
  manifestSchema,
  moduleBundleSchema,
  placementBundleSchema,
  type Manifest,
  type ManifestModule,
  type ModuleBundle,
  type PlacementBundle,
} from '@shiksha/content/schema';
import type { Fetcher, PartialStore } from './download.js';
import { CoreError } from './errors.js';
import {
  installUnit,
  removeUnusedAudio,
  type ContentReport,
  type SyncContext,
  type Unit,
} from './install-unit.js';
import type { BundleStorage, StorageEstimator } from './storage.js';

export type { ContentReport } from './install-unit.js';
export * from './storage.js';

export interface SyncReport {
  source: 'network' | 'cache';
  modules: ContentReport[];
  placement: ContentReport | null;
  removedAudio: number;
}

export interface SyncDeps {
  baseUrl: string;
  fetcher: Fetcher;
  storage: BundleStorage;
  partials: PartialStore;
  estimator: StorageEstimator;
  audio?: 'with' | 'skip';
  skipModules?: ReadonlySet<string>;
}

const HTTP_OK = 200;
const PLACEMENT_ID = 'placement';

/** The fresh manifest if it downloads and passes the schema; otherwise the cached one. */
async function loadManifest(
  ctx: SyncContext,
): Promise<{ manifest: Manifest; source: SyncReport['source'] }> {
  try {
    const res = await ctx.fetcher.get(`${ctx.baseUrl}/manifest.json`);
    if (res.status === HTTP_OK) {
      const raw: unknown = JSON.parse(new TextDecoder().decode(res.bytes));
      return { manifest: manifestSchema.parse(raw), source: 'network' };
    }
  } catch {
    // offline, unreachable or not a valid manifest: fall back to the cache below
  }
  const cached = await ctx.storage.getManifest();
  if (cached) return { manifest: cached, source: 'cache' };
  throw new CoreError('MANIFEST_UNAVAILABLE', 'no lesson list from the server and none saved');
}

async function moduleUnit(
  entry: ManifestModule,
  storage: BundleStorage,
): Promise<Unit<ModuleBundle>> {
  return {
    id: entry.id,
    version: entry.version,
    file: { path: entry.file, sha256: entry.sha256, bytes: entry.bytes },
    stored: await storage.getModule(entry.id),
    parse: (raw) => moduleBundleSchema.parse(raw),
    matches: (b) => b.id === entry.id && b.version === entry.version,
    put: (bundle) => storage.putModule(entry.id, entry.version, bundle),
  };
}

async function placementUnit(
  entry: NonNullable<Manifest['placement']>,
  storage: BundleStorage,
): Promise<Unit<PlacementBundle>> {
  return {
    id: PLACEMENT_ID,
    version: entry.version,
    file: { path: entry.file, sha256: entry.sha256, bytes: entry.bytes },
    stored: await storage.getPlacement(),
    parse: (raw) => placementBundleSchema.parse(raw),
    matches: (b) => b.version === entry.version,
    put: (bundle) => storage.putPlacement(entry.version, bundle),
  };
}

/** Forget modules (and the placement test) that the new manifest no longer lists. */
async function removeDropped(
  previous: Manifest | null,
  manifest: Manifest,
  storage: BundleStorage,
): Promise<void> {
  const kept = new Set(manifest.modules.map((m) => m.id));
  for (const old of previous?.modules ?? []) {
    if (!kept.has(old.id)) await storage.removeModule(old.id);
  }
  if (previous?.placement && !manifest.placement) await storage.removePlacement();
}

/**
 * Bring the phone's lesson packs up to date with the server: download only what changed, verify
 * every file, and store a bundle only once it and its audio are complete. A failure affects that
 * one module; what was installed before stays playable.
 */
export async function syncContent(deps: SyncDeps): Promise<SyncReport> {
  const ctx: SyncContext = {
    ...deps,
    audio: deps.audio ?? 'with',
    protectedAudio: new Set(),
  };
  const previous = await ctx.storage.getManifest();
  const { manifest, source } = await loadManifest(ctx);
  if (source === 'network') await ctx.storage.putManifest(manifest);
  const skip = deps.skipModules ?? new Set<string>();
  const modules: ContentReport[] = [];
  for (const entry of manifest.modules) {
    modules.push(
      skip.has(entry.id)
        ? { id: entry.id, status: 'skipped' }
        : await installUnit(await moduleUnit(entry, ctx.storage), ctx),
    );
  }
  const placement = manifest.placement
    ? await installUnit(await placementUnit(manifest.placement, ctx.storage), ctx)
    : null;
  if (source === 'network') await removeDropped(previous, manifest, ctx.storage);
  return {
    source,
    modules,
    placement,
    removedAudio: await removeUnusedAudio(manifest, ctx.storage, ctx.protectedAudio),
  };
}

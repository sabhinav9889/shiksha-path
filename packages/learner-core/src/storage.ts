import type { Manifest, ModuleBundle, PlacementBundle } from '@shiksha/content/schema';

/** Free space that must stay free after a download, so the phone is never filled to the brim. */
export const STORAGE_SAFETY_MARGIN_BYTES = 5_242_880;

export interface StorageEstimator {
  /** `null` when the platform cannot tell; callers then proceed. */
  estimate(): Promise<{ quota: number; usage: number } | null>;
}

/** Where verified lesson packs live on the device (IndexedDB in the app, memory in tests). */
export interface BundleStorage {
  getManifest(): Promise<Manifest | null>;
  putManifest(manifest: Manifest): Promise<void>;
  getModule(id: string): Promise<{ version: string; bundle: ModuleBundle } | null>;
  putModule(id: string, version: string, bundle: ModuleBundle): Promise<void>;
  removeModule(id: string): Promise<void>;
  getPlacement(): Promise<{ version: string; bundle: PlacementBundle } | null>;
  putPlacement(version: string, bundle: PlacementBundle): Promise<void>;
  removePlacement(): Promise<void>;
  hasAudio(path: string): Promise<boolean>;
  getAudio(path: string): Promise<Uint8Array | null>;
  putAudio(path: string, bytes: Uint8Array): Promise<void>;
  removeAudio(path: string): Promise<void>;
  listAudio(): Promise<string[]>;
}

/** Up to date with the manifest and (unless told otherwise) every audio file present. */
export async function isModuleReady(
  id: string,
  manifest: Manifest,
  storage: BundleStorage,
  opts: { audio?: boolean } = {},
): Promise<boolean> {
  const wanted = manifest.modules.find((m) => m.id === id);
  const stored = await storage.getModule(id);
  if (!wanted || stored?.version !== wanted.version) return false;
  if (opts.audio === false) return true;
  for (const entry of stored.bundle.audio) {
    if (!(await storage.hasAudio(entry.path))) return false;
  }
  return true;
}

/** A verified bundle is stored (any version). Audio is optional: lessons read fine without it. */
export async function isModulePlayable(id: string, storage: BundleStorage): Promise<boolean> {
  return (await storage.getModule(id)) !== null;
}

import type { Manifest, ModuleBundle, PlacementBundle } from '@shiksha/content/schema';
import type { BundleStorage } from '../storage.js';

type Versioned<B> = { version: string; bundle: B };

/** Copies on the way in and out, like a real database, so callers cannot change stored data. */
const copy = <T>(value: T): T => structuredClone(value);

export class MemoryBundleStorage implements BundleStorage {
  private manifest: Manifest | null = null;
  private placement: Versioned<PlacementBundle> | null = null;
  private readonly modules = new Map<string, Versioned<ModuleBundle>>();
  private readonly audio = new Map<string, Uint8Array>();

  getManifest(): Promise<Manifest | null> {
    return Promise.resolve(this.manifest ? copy(this.manifest) : null);
  }

  putManifest(manifest: Manifest): Promise<void> {
    this.manifest = copy(manifest);
    return Promise.resolve();
  }

  getModule(id: string): Promise<Versioned<ModuleBundle> | null> {
    const found = this.modules.get(id);
    return Promise.resolve(found ? copy(found) : null);
  }

  putModule(id: string, version: string, bundle: ModuleBundle): Promise<void> {
    this.modules.set(id, copy({ version, bundle }));
    return Promise.resolve();
  }

  removeModule(id: string): Promise<void> {
    this.modules.delete(id);
    return Promise.resolve();
  }

  getPlacement(): Promise<Versioned<PlacementBundle> | null> {
    return Promise.resolve(this.placement ? copy(this.placement) : null);
  }

  putPlacement(version: string, bundle: PlacementBundle): Promise<void> {
    this.placement = copy({ version, bundle });
    return Promise.resolve();
  }

  removePlacement(): Promise<void> {
    this.placement = null;
    return Promise.resolve();
  }

  hasAudio(path: string): Promise<boolean> {
    return Promise.resolve(this.audio.has(path));
  }

  getAudio(path: string): Promise<Uint8Array | null> {
    const found = this.audio.get(path);
    return Promise.resolve(found ? found.slice() : null);
  }

  putAudio(path: string, bytes: Uint8Array): Promise<void> {
    this.audio.set(path, bytes.slice());
    return Promise.resolve();
  }

  removeAudio(path: string): Promise<void> {
    this.audio.delete(path);
    return Promise.resolve();
  }

  listAudio(): Promise<string[]> {
    return Promise.resolve([...this.audio.keys()].sort());
  }
}

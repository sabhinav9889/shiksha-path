import {
  manifestSchema,
  moduleBundleSchema,
  placementBundleSchema,
  type Manifest,
  type ModuleBundle,
  type PlacementBundle,
} from '@shiksha/content/schema';
import type { BundleStorage } from '@shiksha/learner-core';
import type { ShikshaDb } from './db.js';

const CURRENT = 'current';

type Versioned<B> = { version: string; bundle: B };

/**
 * Lesson packs in IndexedDB. A record that no longer matches its schema (damaged, or written by
 * a different app version) reads as missing, so the learner is offered a download instead of
 * seeing a broken lesson.
 */
export class IdbBundleStorage implements BundleStorage {
  constructor(private readonly db: ShikshaDb) {}

  async getManifest(): Promise<Manifest | null> {
    const row = await this.db.manifest.get(CURRENT);
    const parsed = manifestSchema.safeParse(row?.value);
    return parsed.success ? parsed.data : null;
  }

  async putManifest(manifest: Manifest): Promise<void> {
    await this.db.manifest.put({ id: CURRENT, value: manifest });
  }

  async getModule(id: string): Promise<Versioned<ModuleBundle> | null> {
    const row = await this.db.modules.get(id);
    const parsed = moduleBundleSchema.safeParse(row?.bundle);
    return row && parsed.success ? { version: row.version, bundle: parsed.data } : null;
  }

  async putModule(id: string, version: string, bundle: ModuleBundle): Promise<void> {
    await this.db.modules.put({ id, version, bundle });
  }

  async removeModule(id: string): Promise<void> {
    await this.db.modules.delete(id);
  }

  async getPlacement(): Promise<Versioned<PlacementBundle> | null> {
    const row = await this.db.placement.get(CURRENT);
    const parsed = placementBundleSchema.safeParse(row?.bundle);
    return row && parsed.success ? { version: row.version, bundle: parsed.data } : null;
  }

  async putPlacement(version: string, bundle: PlacementBundle): Promise<void> {
    await this.db.placement.put({ id: CURRENT, version, bundle });
  }

  async removePlacement(): Promise<void> {
    await this.db.placement.delete(CURRENT);
  }

  async hasAudio(path: string): Promise<boolean> {
    return (await this.getAudio(path)) !== null;
  }

  async getAudio(path: string): Promise<Uint8Array | null> {
    const row = await this.db.audio.get(path);
    return row && ArrayBuffer.isView(row.bytes) ? row.bytes : null;
  }

  async putAudio(path: string, bytes: Uint8Array): Promise<void> {
    await this.db.audio.put({ path, bytes });
  }

  async removeAudio(path: string): Promise<void> {
    await this.db.audio.delete(path);
  }

  async listAudio(): Promise<string[]> {
    return (await this.db.audio.orderBy('path').keys()) as string[];
  }
}

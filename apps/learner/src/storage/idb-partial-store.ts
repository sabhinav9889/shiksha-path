import type { PartialStore } from '@shiksha/learner-core';
import type { ShikshaDb } from './db.js';

export class IdbPartialStore implements PartialStore {
  constructor(private readonly db: ShikshaDb) {}

  async get(key: string): Promise<Uint8Array | null> {
    const row = await this.db.partials.get(key);
    return row && ArrayBuffer.isView(row.bytes) ? row.bytes : null;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await this.db.partials.put({ key, bytes });
  }

  async delete(key: string): Promise<void> {
    await this.db.partials.delete(key);
  }
}

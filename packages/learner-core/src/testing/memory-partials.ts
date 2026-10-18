import type { PartialStore } from '../download.js';

export class MemoryPartialStore implements PartialStore {
  private readonly data = new Map<string, Uint8Array>();

  get(key: string): Promise<Uint8Array | null> {
    const found = this.data.get(key);
    return Promise.resolve(found ? found.slice() : null);
  }

  put(key: string, bytes: Uint8Array): Promise<void> {
    this.data.set(key, bytes.slice());
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }
}

import type { ShikshaDb } from '../storage/db.js';

const REMOVED_KEY = 'removedModules';

/** Small learner-independent choices kept on the device. */
export class Prefs {
  constructor(private readonly db: ShikshaDb) {}

  /** Modules the learner removed to free space: a sync must not bring them back. */
  async removedModules(): Promise<Set<string>> {
    const row = await this.db.meta.get(REMOVED_KEY);
    try {
      const parsed: unknown = JSON.parse(row?.value ?? '[]');
      return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  }

  async markRemoved(id: string): Promise<void> {
    await this.save((removed) => removed.add(id));
  }

  async clearRemoved(id: string): Promise<void> {
    await this.save((removed) => removed.delete(id));
  }

  private async save(change: (removed: Set<string>) => unknown): Promise<void> {
    const removed = await this.removedModules();
    change(removed);
    await this.db.meta.put({ key: REMOVED_KEY, value: JSON.stringify([...removed]) });
  }
}

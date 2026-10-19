import {
  CoreError,
  fetchMissingAudio,
  removeModuleContent,
  syncContent,
  type BundleStorage,
  type ErrorCode,
  type Fetcher,
  type PartialStore,
  type StorageEstimator,
  type SyncReport,
} from '@shiksha/learner-core';
import type { Prefs } from './prefs.js';

export type ContentResult<T> = { ok: true; value: T } | { ok: false; error: ErrorCode };

interface ContentDeps {
  baseUrl: string;
  fetcher: Fetcher;
  storage: BundleStorage;
  partials: PartialStore;
  estimator: StorageEstimator;
  prefs: Prefs;
}

/**
 * Everything that changes the lesson packs on the phone, one operation at a time: a sync can
 * never overlap a removal or an audio repair, so none can delete files another is installing.
 */
export class ContentService {
  private chain: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private readonly listeners = new Set<() => void>();
  private changes = 0;
  /** Audio a sync must not delete; the app points this at the lesson on screen. */
  keepAudio: () => ReadonlySet<string> = () => new Set();

  constructor(private readonly deps: ContentDeps) {}

  /** Goes up whenever stored lesson content changed, so a session knows to reopen. */
  get version(): number {
    return this.changes;
  }

  get busy(): boolean {
    return this.queued > 0;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  sync(): Promise<ContentResult<SyncReport>> {
    return this.run(() => this.doSync());
  }

  fetchAudio(moduleId: string): Promise<ContentResult<{ fetched: number }>> {
    return this.run(async () => {
      const result = await fetchMissingAudio(moduleId, this.deps);
      if (result.fetched > 0) this.changes += 1;
      return result;
    });
  }

  remove(moduleId: string): Promise<ContentResult<{ removedAudio: number }>> {
    return this.run(async () => {
      await this.deps.prefs.markRemoved(moduleId);
      const result = await removeModuleContent(moduleId, this.deps.storage);
      this.changes += 1;
      return result;
    });
  }

  restore(moduleId: string): Promise<ContentResult<SyncReport>> {
    return this.run(async () => {
      await this.deps.prefs.clearRemoved(moduleId);
      return this.doSync();
    });
  }

  private async doSync(): Promise<SyncReport> {
    const skipModules = await this.deps.prefs.removedModules();
    const report = await syncContent({
      ...this.deps,
      skipModules,
      keepAudio: () => this.keepAudio(),
    });
    const installed = [...report.modules, report.placement].some((r) => r?.status === 'installed');
    if (installed || report.removedAudio > 0) this.changes += 1;
    return report;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private run<T>(operation: () => Promise<T>): Promise<ContentResult<T>> {
    this.queued += 1;
    this.notify();
    const task = this.chain.then(async (): Promise<ContentResult<T>> => {
      try {
        return { ok: true, value: await operation() };
      } catch (error) {
        return { ok: false, error: error instanceof CoreError ? error.code : 'DOWNLOAD_FAILED' };
      } finally {
        this.queued -= 1;
        this.notify();
      }
    });
    this.chain = task;
    return task;
  }
}

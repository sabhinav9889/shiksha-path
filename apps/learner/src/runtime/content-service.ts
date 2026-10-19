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

  constructor(private readonly deps: ContentDeps) {}

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
    return this.run(() => fetchMissingAudio(moduleId, this.deps));
  }

  remove(moduleId: string): Promise<ContentResult<{ removedAudio: number }>> {
    return this.run(async () => {
      await this.deps.prefs.markRemoved(moduleId);
      return removeModuleContent(moduleId, this.deps.storage);
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
    return syncContent({ ...this.deps, skipModules });
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

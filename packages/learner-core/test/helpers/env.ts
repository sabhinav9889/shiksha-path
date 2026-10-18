import { MemoryBundleStorage, MemoryPartialStore } from '../../src/testing/index.js';
import {
  syncContent,
  type StorageEstimator,
  type SyncDeps,
  type SyncReport,
} from '../../src/install.js';
import { makeContentFixture, type ContentFixture } from './content-fixture.js';
import { serveBuild, type ServedBuild } from './serve-build.js';

export const unlimited: StorageEstimator = { estimate: () => Promise.resolve(null) };

export const withSpace = (free: number): StorageEstimator => ({
  estimate: () => Promise.resolve({ quota: free, usage: 0 }),
});

export interface Env {
  fixture: ContentFixture;
  server: ServedBuild;
  storage: MemoryBundleStorage;
  partials: MemoryPartialStore;
  deps: Omit<SyncDeps, 'audio' | 'skipModules'>;
  sync(options?: Partial<SyncDeps>): Promise<SyncReport>;
}

/** A built fixture, a server over it and an empty phone (storage, partials). */
export async function makeEnv(): Promise<Env> {
  const fixture = await makeContentFixture();
  const server = serveBuild(fixture.outDir);
  const storage = new MemoryBundleStorage();
  const partials = new MemoryPartialStore();
  const deps = {
    baseUrl: server.baseUrl,
    fetcher: server.fetcher,
    storage,
    partials,
    estimator: unlimited,
  };
  return {
    fixture,
    server,
    storage,
    partials,
    deps,
    sync: (o = {}) => syncContent({ ...deps, ...o }),
  };
}

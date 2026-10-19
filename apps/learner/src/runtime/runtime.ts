import {
  cryptoIds,
  flushOutbox,
  LearnerSession,
  systemClock,
  type BundleStorage,
  type Clock,
  type EventStore,
  type FlushResult,
  type Ids,
  type PartialStore,
  type ProfileStore,
  type StorageEstimator,
} from '@shiksha/learner-core';
import { ShikshaDb } from '../storage/db.js';
import { browserStorageEstimator } from '../storage/estimator.js';
import { IdbBundleStorage } from '../storage/idb-bundle-storage.js';
import { IdbEventStore } from '../storage/idb-event-store.js';
import { IdbPartialStore } from '../storage/idb-partial-store.js';
import { IdbProfileStore } from '../storage/idb-profile-store.js';
import { IdbRecordingStore } from '../storage/idb-recording-store.js';
import type { RecordingStore } from '../storage/recording-store.js';
import { ContentService } from './content-service.js';
import { createFetcher } from './fetcher.js';
import { Prefs } from './prefs.js';
import { noServerTransport } from './transport.js';

const ALL_PENDING = Number.MAX_SAFE_INTEGER;

export interface Runtime {
  storage: BundleStorage;
  events: EventStore;
  profiles: ProfileStore;
  recordings: RecordingStore;
  partials: PartialStore;
  clock: Clock;
  ids: Ids;
  prefs: Prefs;
  content: ContentService;
  openSession(profileId: string): Promise<LearnerSession>;
  syncStatus(learnerId: string): Promise<{ lastSyncedAt: string | null; pending: number }>;
  flush(learnerId: string): Promise<FlushResult>;
}

interface RuntimeOptions {
  dbName?: string;
  contentBaseUrl?: string;
  fetchFn?: typeof fetch;
  clock?: Clock;
  ids?: Ids;
  estimator?: StorageEstimator;
}

/** Wires the browser adapters to the core's ports. One per app (tests make their own). */
export function createRuntime(opts: RuntimeOptions = {}): Runtime {
  const db = new ShikshaDb(opts.dbName);
  const storage = new IdbBundleStorage(db);
  const events = new IdbEventStore(db);
  const partials = new IdbPartialStore(db);
  const prefs = new Prefs(db);
  const clock = opts.clock ?? systemClock;
  const ids = opts.ids ?? cryptoIds;
  const content = new ContentService({
    baseUrl: opts.contentBaseUrl ?? import.meta.env.VITE_CONTENT_BASE_URL ?? '/content',
    fetcher: createFetcher(opts.fetchFn),
    storage,
    partials,
    estimator: opts.estimator ?? browserStorageEstimator(),
    prefs,
  });
  return {
    storage,
    events,
    profiles: new IdbProfileStore(db),
    recordings: new IdbRecordingStore(db),
    partials,
    clock,
    ids,
    prefs,
    content,
    openSession: (profileId) =>
      LearnerSession.open({ learnerId: profileId, storage, events, clock, ids }),
    async syncStatus(learnerId) {
      const lastSyncedAt = await events.getMeta(`lastSyncedAt:${learnerId}`);
      return { lastSyncedAt, pending: (await events.pending(learnerId, ALL_PENDING)).length };
    },
    flush: (learnerId) =>
      flushOutbox(learnerId, { store: events, transport: noServerTransport, clock }),
  };
}

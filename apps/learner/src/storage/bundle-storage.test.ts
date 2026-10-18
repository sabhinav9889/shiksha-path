import 'fake-indexeddb/auto';
import { describeBundleStorage } from '@shiksha/learner-core/testing';
import { describe, expect, test } from 'vitest';
import { ShikshaDb } from './db.js';
import { browserStorageEstimator } from './estimator.js';
import { IdbBundleStorage } from './idb-bundle-storage.js';
import { IdbPartialStore } from './idb-partial-store.js';

let counter = 0;
const freshDb = (): ShikshaDb => new ShikshaDb(`bundle-test-${counter++}`);

describeBundleStorage('IdbBundleStorage', () => new IdbBundleStorage(freshDb()));

describe('damaged records read as not installed', () => {
  test('a manifest, a module and a placement with the wrong shape are null', async () => {
    const db = freshDb();
    const storage = new IdbBundleStorage(db);
    await db.manifest.put({ id: 'current', value: { not: 'a manifest' } });
    await db.modules.put({ id: 'm1', version: 'aaaaaaaaaaaa', bundle: { junk: true } });
    await db.placement.put({ id: 'current', version: 'aaaaaaaaaaaa', bundle: 42 });
    expect(await storage.getManifest()).toBeNull();
    expect(await storage.getModule('m1')).toBeNull();
    expect(await storage.getPlacement()).toBeNull();
  });

  test('audio that is not bytes is not present', async () => {
    const db = freshDb();
    const storage = new IdbBundleStorage(db);
    await db.audio.put({ path: 'audio/0123456789abcdef.mp3', bytes: 'oops' as never });
    expect(await storage.hasAudio('audio/0123456789abcdef.mp3')).toBe(false);
    expect(await storage.getAudio('audio/0123456789abcdef.mp3')).toBeNull();
  });
});

describe('IdbPartialStore', () => {
  test('stores, reads and deletes a partial download', async () => {
    const store = new IdbPartialStore(freshDb());
    expect(await store.get('k')).toBeNull();
    await store.put('k', Uint8Array.of(1, 2, 3));
    expect(await store.get('k')).toEqual(Uint8Array.of(1, 2, 3));
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });
});

describe('browserStorageEstimator', () => {
  test('passes quota and usage through', async () => {
    const api = { estimate: () => Promise.resolve({ quota: 100, usage: 40 }) };
    expect(await browserStorageEstimator(api).estimate()).toEqual({ quota: 100, usage: 40 });
  });

  test('is null when the API is missing, incomplete or fails', async () => {
    expect(await browserStorageEstimator(undefined).estimate()).toBeNull();
    const noQuota = { estimate: () => Promise.resolve({ usage: 1 }) };
    expect(await browserStorageEstimator(noQuota).estimate()).toBeNull();
    const broken = { estimate: () => Promise.reject(new Error('denied')) };
    expect(await browserStorageEstimator(broken).estimate()).toBeNull();
  });
});

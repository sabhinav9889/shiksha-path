import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, test } from 'vitest';
import { ShikshaDb } from './db.js';
import { IdbRecordingStore } from './idb-recording-store.js';
import { MAX_RECORDING_BYTES, type Recording } from './recording-store.js';

let counter = 0;
const freshName = (): string => `recording-test-${counter++}`;

const recording = (over: Partial<Recording> = {}): Recording => ({
  id: `r-${counter++}`,
  learnerId: 'a',
  lessonId: 'ef1-02',
  itemId: 's1',
  mime: 'audio/webm',
  bytes: Uint8Array.of(1, 2, 3),
  durationMs: 2000,
  at: '2026-10-19T10:00:00.000Z',
  ...over,
});

describe('IdbRecordingStore', () => {
  test('round-trips a recording', async () => {
    const store = new IdbRecordingStore(new ShikshaDb(freshName()));
    const r = recording();
    await store.put(r);
    expect(await store.latest('a', 'ef1-02', 's1')).toEqual(r);
    expect(await store.latest('a', 'ef1-02', 'other')).toBeNull();
  });

  test('a new recording of the same item replaces the earlier one', async () => {
    const store = new IdbRecordingStore(new ShikshaDb(freshName()));
    await store.put(recording({ bytes: Uint8Array.of(1) }));
    const second = recording({ bytes: Uint8Array.of(9, 9) });
    await store.put(second);
    expect(await store.latest('a', 'ef1-02', 's1')).toEqual(second);
    expect(await store.summary('a')).toEqual({ count: 1, bytes: 2 });
  });

  test("two learners' recordings of the same item stay separate", async () => {
    const store = new IdbRecordingStore(new ShikshaDb(freshName()));
    await store.put(recording({ learnerId: 'a', bytes: Uint8Array.of(1) }));
    await store.put(recording({ learnerId: 'b', bytes: Uint8Array.of(1, 2, 3, 4) }));
    expect(await store.summary('a')).toEqual({ count: 1, bytes: 1 });
    expect(await store.summary('b')).toEqual({ count: 1, bytes: 4 });
    expect((await store.latest('a', 'ef1-02', 's1'))?.bytes).toEqual(Uint8Array.of(1));
  });

  test('delete removes one recording', async () => {
    const store = new IdbRecordingStore(new ShikshaDb(freshName()));
    const r = recording();
    await store.put(r);
    await store.delete(r.id);
    expect(await store.latest('a', 'ef1-02', 's1')).toBeNull();
    expect(await store.summary('a')).toEqual({ count: 0, bytes: 0 });
  });

  test('refuses a recording over 1 MiB and accepts exactly 1 MiB', async () => {
    const store = new IdbRecordingStore(new ShikshaDb(freshName()));
    expect(MAX_RECORDING_BYTES).toBe(1_048_576);
    await expect(
      store.put(recording({ bytes: new Uint8Array(MAX_RECORDING_BYTES + 1) })),
    ).rejects.toThrow('recording too large');
    expect(await store.summary('a')).toEqual({ count: 0, bytes: 0 });
    await store.put(recording({ bytes: new Uint8Array(MAX_RECORDING_BYTES) }));
    expect((await store.summary('a')).count).toBe(1);
  });
});

describe('upgrading the database to version 2', () => {
  test('keeps version-1 data and adds a working recordings table', async () => {
    const name = freshName();
    const old = new Dexie(name);
    old.version(1).stores({
      manifest: 'id',
      modules: 'id',
      placement: 'id',
      audio: 'path',
      partials: 'key',
      events: '++seq, &id, learnerId',
      sent: 'id',
      meta: 'key',
      profiles: 'id, createdAt',
    });
    await old.table('profiles').put({ id: 'p1', name: 'प्रिया', createdAt: '2026-10-19' });
    await old.table('meta').put({ key: 'k', value: 'v' });
    old.close();

    const db = new ShikshaDb(name);
    expect((await db.profiles.get('p1'))?.name).toBe('प्रिया');
    expect((await db.meta.get('k'))?.value).toBe('v');
    const store = new IdbRecordingStore(db);
    await store.put(recording());
    expect((await store.summary('a')).count).toBe(1);
  });

  test('uploaded recordings drop their bytes, keep their details, and no longer wait', async () => {
    const store = new IdbRecordingStore(new ShikshaDb(freshName()));
    const [one, two] = [recording(), recording({ itemId: 's2' })];
    await store.put(one);
    await store.put(two);
    await store.put(recording({ learnerId: 'b' }));
    expect((await store.pendingUpload('a')).map((r) => r.id).sort()).toEqual(
      [one.id, two.id].sort(),
    );
    await store.markUploaded(one.id, '2026-10-22T10:00:00.000Z');
    expect((await store.pendingUpload('a')).map((r) => r.id)).toEqual([two.id]);
    const kept = await store.latest('a', 'ef1-02', 's1');
    expect(kept?.bytes.length).toBe(0);
    expect(kept?.uploadedAt).toBe('2026-10-22T10:00:00.000Z');
    expect(await store.summary('a')).toEqual({ count: 1, bytes: 3 });
  });
});

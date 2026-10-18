import 'fake-indexeddb/auto';
import type { Fetcher } from '@shiksha/learner-core';
import { MemoryBundleStorage, MemoryPartialStore } from '@shiksha/learner-core/testing';
import { makeContentFixture } from '@shiksha/learner-core/test-helpers/content-fixture';
import { serveBuild, type ServedBuild } from '@shiksha/learner-core/test-helpers/serve-build';
import { beforeEach, describe, expect, test } from 'vitest';
import { ShikshaDb } from '../storage/db.js';
import { ContentService } from './content-service.js';
import { Prefs } from './prefs.js';

const EN = 'english-foundation-1';
let counter = 0;
let server: ServedBuild;
let storage: MemoryBundleStorage;
let prefs: Prefs;
let gate: { release(): void; wait: Promise<void> } | null;

function makeService(): ContentService {
  const fetcher: Fetcher = {
    get: async (url, range) => {
      if (gate && url.endsWith('manifest.json')) await gate.wait;
      return server.fetcher.get(url, range);
    },
  };
  return new ContentService({
    baseUrl: server.baseUrl,
    fetcher,
    storage,
    partials: new MemoryPartialStore(),
    estimator: { estimate: () => Promise.resolve(null) },
    prefs,
  });
}

beforeEach(async () => {
  const fixture = await makeContentFixture();
  server = serveBuild(fixture.outDir);
  storage = new MemoryBundleStorage();
  prefs = new Prefs(new ShikshaDb(`content-test-${counter++}`));
  gate = null;
});

describe('ContentService', () => {
  test('sync installs the modules', async () => {
    const result = await makeService().sync();
    expect(result.ok).toBe(true);
    expect(await storage.getModule(EN)).not.toBeNull();
  });

  test('a missing lesson list is reported as an error code, not thrown', async () => {
    server.failing.add('manifest.json');
    expect(await makeService().sync()).toEqual({ ok: false, error: 'MANIFEST_UNAVAILABLE' });
  });

  test('a second call waits for the first, so a sync never overlaps a removal', async () => {
    let release = (): void => undefined;
    gate = { release: () => release(), wait: new Promise<void>((resolve) => (release = resolve)) };
    const service = makeService();
    const sync = service.sync();
    const removal = service.remove(EN);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await prefs.removedModules()).toEqual(new Set()); // the removal has not started
    gate.release();
    await Promise.all([sync, removal]);
    expect(await prefs.removedModules()).toEqual(new Set([EN]));
    expect(await storage.getModule(EN)).toBeNull();
  });

  test('a removed module stays removed through later syncs until it is restored', async () => {
    const service = makeService();
    await service.sync();
    await service.remove(EN);
    await service.sync();
    expect(await storage.getModule(EN)).toBeNull();
    expect((await service.restore(EN)).ok).toBe(true);
    expect(await storage.getModule(EN)).not.toBeNull();
    expect(await prefs.removedModules()).toEqual(new Set());
  });

  test('fetchAudio repairs missing audio, and an unknown module is an error code', async () => {
    const service = makeService();
    await service.sync();
    const [victim] = await storage.listAudio();
    await storage.removeAudio(victim ?? '');
    expect(await service.fetchAudio(EN)).toMatchObject({ ok: true });
    expect(await storage.hasAudio(victim ?? '')).toBe(true);
    expect(await service.fetchAudio('nope')).toEqual({ ok: false, error: 'MODULE_NOT_READY' });
  });

  test('busy is true while work is queued, and subscribers hear about changes', async () => {
    const service = makeService();
    const seen: boolean[] = [];
    const stop = service.subscribe(() => seen.push(service.busy));
    expect(service.busy).toBe(false);
    const run = service.sync();
    expect(service.busy).toBe(true);
    await run;
    expect(service.busy).toBe(false);
    expect(seen).toEqual([true, false]);
    stop();
    await service.sync();
    expect(seen).toEqual([true, false]);
  });
});

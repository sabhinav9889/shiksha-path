import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { manifestSchema, type Manifest } from '@shiksha/content/schema';
import { beforeEach, describe, expect, test } from 'vitest';
import type { CoreError } from '../src/errors.js';
import {
  STORAGE_SAFETY_MARGIN_BYTES,
  isModulePlayable,
  isModuleReady,
  syncContent,
  type StorageEstimator,
  type SyncReport,
} from '../src/install.js';
import {
  MemoryBundleStorage,
  MemoryPartialStore,
  describeBundleStorage,
} from '../src/testing/index.js';
import { makeContentFixture, type ContentFixture } from './helpers/content-fixture.js';
import { serveBuild, type ServedBuild } from './helpers/serve-build.js';

const EN = 'english-foundation-1';
const APT = 'aptitude-1';
const MIB = 1_048_576;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describeBundleStorage('MemoryBundleStorage', () => new MemoryBundleStorage());

let fixture: ContentFixture;
let server: ServedBuild;
let storage: MemoryBundleStorage;
let partials: MemoryPartialStore;

beforeEach(async () => {
  fixture = await makeContentFixture();
  server = serveBuild(fixture.outDir);
  storage = new MemoryBundleStorage();
  partials = new MemoryPartialStore();
});

const readManifest = async (): Promise<Manifest> =>
  manifestSchema.parse(JSON.parse(await readFile(join(fixture.outDir, 'manifest.json'), 'utf8')));

const unlimited: StorageEstimator = { estimate: () => Promise.resolve(null) };
const withSpace = (free: number): StorageEstimator => ({
  estimate: () => Promise.resolve({ quota: free, usage: 0 }),
});

type Options = Partial<Parameters<typeof syncContent>[0]>;
const sync = (options: Options = {}): Promise<SyncReport> =>
  syncContent({
    baseUrl: server.baseUrl,
    fetcher: server.fetcher,
    storage,
    partials,
    estimator: unlimited,
    ...options,
  });

const statuses = (report: SyncReport): Record<string, string> =>
  Object.fromEntries(report.modules.map((m) => [m.id, m.status]));

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: CoreError) => error.code,
  );

/** Replace one module's file with a changed bundle and make the manifest agree with it. */
async function forgeModule(
  id: string,
  change: (bundle: Record<string, unknown>) => void,
): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(fixture.outDir, 'manifest.json'), 'utf8'),
  ) as Manifest;
  const entry = manifest.modules.find((m) => m.id === id);
  if (!entry) throw new Error('no such module');
  const bundle = JSON.parse(await readFile(join(fixture.outDir, entry.file), 'utf8')) as Record<
    string,
    unknown
  >;
  change(bundle);
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  entry.sha256 = sha256(bytes);
  entry.bytes = bytes.length;
  server.overrides.set(entry.file, bytes);
  server.overrides.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)));
}

describe('first sync', () => {
  test('installs every module and the placement test, with audio', async () => {
    const report = await sync();
    expect(report.source).toBe('network');
    expect(statuses(report)).toEqual({ [EN]: 'installed', [APT]: 'installed' });
    expect(report.placement?.status).toBe('installed');
    const manifest = await storage.getManifest();
    expect(manifest).toEqual(await readManifest());
    for (const id of [EN, APT]) {
      expect(await isModuleReady(id, manifest as Manifest, storage)).toBe(true);
    }
    expect(await storage.listAudio()).toHaveLength(2);
    expect(await storage.getPlacement()).not.toBeNull();
  });

  test('a second sync with nothing new requests only the manifest', async () => {
    await sync();
    server.reset();
    const report = await sync();
    expect(statuses(report)).toEqual({ [EN]: 'ready', [APT]: 'ready' });
    expect(report.placement?.status).toBe('ready');
    expect(server.requested()).toEqual(['manifest.json']);
  });
});

describe('a changed build', () => {
  test('re-requests only what changed and removes the replaced audio', async () => {
    await sync();
    const before = await storage.listAudio();
    await fixture.rebuild((files) => {
      const lesson = 'modules/english-foundation-1/lessons/02.md';
      files[lesson] = String(files[lesson]).replace('lesson 2.', 'lesson two.');
      files['modules/english-foundation-1/audio/intro.mp3'] = new TextEncoder().encode('new-intro');
    });
    server.reset();
    const report = await sync();
    const after = await readManifest();
    const english = after.modules.find((m) => m.id === EN);
    expect(statuses(report)).toEqual({ [EN]: 'installed', [APT]: 'ready' });
    expect(server.requested()).toHaveLength(3);
    expect(server.requested()).toContain('manifest.json');
    expect(server.requested()).toContain(english?.file);
    expect(report.removedAudio).toBe(1);
    const now = await storage.listAudio();
    expect(now).toHaveLength(before.length);
    expect(now.filter((p) => !before.includes(p))).toHaveLength(1);
  });
});

describe('offline and hostile manifests', () => {
  test('uses the cached manifest when the network is down', async () => {
    await sync();
    server.failing.add('manifest.json');
    const report = await sync();
    expect(report.source).toBe('cache');
    expect(statuses(report)).toEqual({ [EN]: 'ready', [APT]: 'ready' });
  });

  test('without a cache it throws MANIFEST_UNAVAILABLE', async () => {
    server.failing.add('manifest.json');
    expect(await codeOf(sync())).toBe('MANIFEST_UNAVAILABLE');
  });

  test('a manifest that fails the schema is rejected and the cache is used', async () => {
    await sync();
    const manifest = await readManifest();
    const hostile = { ...manifest, modules: [{ ...manifest.modules[0], file: '../x.json' }] };
    server.overrides.set('manifest.json', new TextEncoder().encode(JSON.stringify(hostile)));
    server.reset();
    const report = await sync();
    expect(report.source).toBe('cache');
    expect(server.requested()).toEqual(['manifest.json']);
    expect(await storage.getManifest()).toEqual(manifest);
  });
});

describe('failures are per module', () => {
  test('a wrong hash fails that module only and keeps the old version playable', async () => {
    await sync();
    await fixture.rebuild((files) => {
      const lesson = 'modules/english-foundation-1/lessons/02.md';
      files[lesson] = String(files[lesson]).replace('lesson 2.', 'lesson two.');
    });
    const manifest = await readManifest();
    const file = manifest.modules.find((m) => m.id === EN)?.file ?? '';
    const real = new Uint8Array(await readFile(join(fixture.outDir, file)));
    real[0] = (real[0] ?? 0) ^ 1;
    server.overrides.set(file, real);
    const report = await sync();
    expect(report.modules.find((m) => m.id === EN)).toMatchObject({
      status: 'failed',
      error: 'BUNDLE_CORRUPT',
    });
    expect(report.modules.find((m) => m.id === APT)?.status).toBe('ready');
    expect(await isModulePlayable(EN, storage)).toBe(true);
    expect(await isModuleReady(EN, manifest, storage)).toBe(false);
  });

  test.each([
    ['id', { id: 'something-else' }],
    ['version', { version: 'ffffffffffff' }],
  ])('a bundle whose %s differs from the manifest is BUNDLE_CORRUPT', async (_name, change) => {
    await forgeModule(EN, (bundle) => Object.assign(bundle, change));
    const report = await sync();
    expect(report.modules.find((m) => m.id === EN)).toMatchObject({
      status: 'failed',
      error: 'BUNDLE_CORRUPT',
    });
    expect(await isModulePlayable(EN, storage)).toBe(false);
    expect(report.modules.find((m) => m.id === APT)?.status).toBe('installed');
  });

  test('a dropped audio download fails that module and leaves nothing half-installed', async () => {
    const manifest = await readManifest();
    const audio = JSON.parse(
      await readFile(join(fixture.outDir, manifest.modules[0]?.file ?? ''), 'utf8'),
    ) as { audio: { path: string }[] };
    server.failing.add(audio.audio[0]?.path ?? '');
    const report = await sync();
    expect(report.modules.find((m) => m.id === EN)).toMatchObject({
      status: 'failed',
      error: 'DOWNLOAD_FAILED',
    });
    expect(await isModulePlayable(EN, storage)).toBe(false);
  });
});

describe('low storage', () => {
  test('the module that does not fit fails with LOW_STORAGE; a smaller one still installs', async () => {
    const manifest = await readManifest();
    const [en, apt] = [EN, APT].map((id) => manifest.modules.find((m) => m.id === id));
    const need = (m?: { bytes: number; audio_bytes: number }): number =>
      (m?.bytes ?? 0) + (m?.audio_bytes ?? 0);
    // English's JSON fits but JSON plus audio does not; aptitude fits whole.
    const free = STORAGE_SAFETY_MARGIN_BYTES + (en?.bytes ?? 0) + 1;
    expect(free - STORAGE_SAFETY_MARGIN_BYTES).toBeGreaterThanOrEqual(need(apt));
    const report = await sync({ estimator: withSpace(free) });
    expect(report.modules.find((m) => m.id === EN)).toMatchObject({
      status: 'failed',
      error: 'LOW_STORAGE',
      details: { neededBytes: need(en), freeBytes: free },
    });
    expect(report.modules.find((m) => m.id === APT)?.status).toBe('installed');
    expect(await storage.getModule(EN)).toBeNull();
    expect(await isModulePlayable(APT, storage)).toBe(true);
    expect(await storage.listAudio()).toHaveLength(1);
  });

  test('with 1 MiB free of 10 MiB nothing fits past the safety margin', async () => {
    const estimator = { estimate: () => Promise.resolve({ quota: 10 * MIB, usage: 9 * MIB }) };
    const report = await sync({ estimator });
    expect(report.modules.map((m) => m.error)).toEqual(['LOW_STORAGE', 'LOW_STORAGE']);
    expect(report.placement?.error).toBe('LOW_STORAGE');
    expect(await storage.getModule(EN)).toBeNull();
    expect(await storage.getPlacement()).toBeNull();
  });

  test('an estimator that cannot tell lets the install proceed', async () => {
    const report = await sync({ estimator: unlimited });
    expect(statuses(report)).toEqual({ [EN]: 'installed', [APT]: 'installed' });
  });
});

describe('audio and readiness', () => {
  test('a missing audio file makes the module not ready but still playable, and sync repairs it', async () => {
    await sync();
    const manifest = await readManifest();
    const [victim] = await storage.listAudio();
    await storage.removeAudio(victim ?? '');
    const ready = [
      await isModuleReady(EN, manifest, storage),
      await isModuleReady(APT, manifest, storage),
    ];
    expect(ready).toContain(false);
    expect(await isModulePlayable(EN, storage)).toBe(true);
    expect(await isModulePlayable(APT, storage)).toBe(true);
    server.reset();
    await sync();
    expect(server.requested()).toEqual(['manifest.json', victim ?? ''].sort());
    expect(await isModuleReady(EN, manifest, storage)).toBe(true);
    expect(await isModuleReady(APT, manifest, storage)).toBe(true);
  });

  test('a stored version that differs from the manifest is not ready', async () => {
    await sync();
    const manifest = await readManifest();
    const stale = {
      ...manifest,
      modules: manifest.modules.map((m) => ({ ...m, version: 'ffffffffffff' })),
    };
    expect(await isModuleReady(EN, stale, storage)).toBe(false);
    expect(await isModuleReady('no-such-module', manifest, storage)).toBe(false);
  });

  test('skipModules neither requests nor installs a module, and keeps one already stored', async () => {
    const report = await sync({ skipModules: new Set([EN]) });
    expect(statuses(report)).toEqual({ [EN]: 'skipped', [APT]: 'installed' });
    expect(await storage.getModule(EN)).toBeNull();
    expect(server.requested().some((p) => p.includes('english'))).toBe(false);
    await sync();
    expect(await isModulePlayable(EN, storage)).toBe(true);
    const again = await sync({ skipModules: new Set([EN]) });
    expect(statuses(again)[EN]).toBe('skipped');
    expect(await isModulePlayable(EN, storage)).toBe(true);
    expect((await storage.listAudio()).length).toBe(2);
  });

  test("audio: 'skip' installs the lessons without audio, and a second skip sync is ready", async () => {
    const report = await sync({ audio: 'skip' });
    expect(statuses(report)).toEqual({ [EN]: 'installed', [APT]: 'installed' });
    expect(server.requested().some((p) => p.startsWith('audio/'))).toBe(false);
    expect(await isModulePlayable(EN, storage)).toBe(true);
    server.reset();
    const again = await sync({ audio: 'skip' });
    expect(statuses(again)).toEqual({ [EN]: 'ready', [APT]: 'ready' });
    expect(server.requested()).toEqual(['manifest.json']);
  });

  test('removes modules that left the manifest, with their audio', async () => {
    await sync();
    await fixture.rebuild((files) => {
      for (const path of Object.keys(files)) {
        if (path.startsWith('modules/aptitude-1/')) delete files[path];
      }
      const placement = 'placement/placement.yaml';
      files[placement] = String(files[placement]).replace(/ {2}- track: aptitude[\s\S]*$/, '');
    });
    const report = await sync();
    expect(statuses(report)).toEqual({ [EN]: 'ready' });
    expect(await storage.getModule(APT)).toBeNull();
  });
});

describe('keepAudio', () => {
  test('audio listed in keepAudio survives a cleanup, and goes on the next sync without it', async () => {
    await sync();
    const before = await storage.listAudio();
    await fixture.rebuild((files) => {
      files['modules/english-foundation-1/audio/intro.mp3'] = new TextEncoder().encode('new-intro');
    });
    const report = await sync({ keepAudio: new Set(before) });
    expect(report.removedAudio).toBe(0);
    for (const path of before) expect(await storage.hasAudio(path)).toBe(true);
    const later = await sync();
    expect(later.removedAudio).toBe(1);
  });
});

import { beforeEach, describe, expect, test } from 'vitest';
import type { CoreError } from '../src/errors.js';
import { STORAGE_SAFETY_MARGIN_BYTES, isModulePlayable, isModuleReady } from '../src/install.js';
import { fetchMissingAudio, missingAudio, removeModuleContent } from '../src/storage-management.js';
import { makeEnv, withSpace, type Env } from './helpers/env.js';

const EN = 'english-foundation-1';
const APT = 'aptitude-1';

let env: Env;
beforeEach(async () => {
  env = await makeEnv();
});

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: CoreError) => error.code,
  );

const audioOf = async (id: string): Promise<{ path: string; bytes: number }[]> =>
  (await env.storage.getModule(id))?.bundle.audio ?? [];

const fetchDeps = (): Parameters<typeof fetchMissingAudio>[1] => ({
  baseUrl: env.server.baseUrl,
  fetcher: env.server.fetcher,
  storage: env.storage,
  partials: env.partials,
  estimator: env.deps.estimator,
});

describe('missingAudio', () => {
  test('lists exactly the files removed from storage and is empty when complete', async () => {
    await env.sync();
    expect(await missingAudio(EN, env.storage)).toEqual([]);
    const [first] = await audioOf(EN);
    await env.storage.removeAudio(first?.path ?? '');
    expect(await missingAudio(EN, env.storage)).toEqual([first?.path]);
  });

  test('an unknown module is MODULE_NOT_READY', async () => {
    expect(await codeOf(missingAudio('nope', env.storage))).toBe('MODULE_NOT_READY');
  });
});

describe('fetchMissingAudio', () => {
  test("after an audio: 'skip' sync it fetches exactly the module's audio, then nothing", async () => {
    await env.sync({ audio: 'skip' });
    const manifest = await env.storage.getManifest();
    expect(await isModuleReady(EN, manifest ?? ({} as never), env.storage)).toBe(false);
    env.server.reset();
    const result = await fetchMissingAudio(EN, fetchDeps());
    const wanted = (await audioOf(EN)).map((a) => a.path).sort();
    expect(result.fetched).toBe(wanted.length);
    expect(env.server.requested()).toEqual(wanted);
    expect(await isModuleReady(EN, manifest ?? ({} as never), env.storage)).toBe(true);
    env.server.reset();
    expect((await fetchMissingAudio(EN, fetchDeps())).fetched).toBe(0);
    expect(env.server.requests).toHaveLength(0);
  });

  test('a hash mismatch is BUNDLE_CORRUPT; earlier files stay, that one is not stored', async () => {
    await env.sync({ audio: 'skip' });
    const [first, second] = await audioOf(EN);
    const real = new Uint8Array(
      await (
        await env.deps.fetcher.get(`${env.server.baseUrl}/${second?.path}`)
      ).bytes,
    );
    real[0] = (real[0] ?? 0) ^ 1;
    env.server.overrides.set(second?.path ?? '', real);
    expect(await codeOf(fetchMissingAudio(EN, fetchDeps()))).toBe('BUNDLE_CORRUPT');
    expect(await env.storage.hasAudio(first?.path ?? '')).toBe(true);
    expect(await env.storage.hasAudio(second?.path ?? '')).toBe(false);
  });

  test('low storage is LOW_STORAGE with details and writes nothing', async () => {
    await env.sync({ audio: 'skip' });
    const needed = (await audioOf(EN)).reduce((n, a) => n + a.bytes, 0);
    const free = STORAGE_SAFETY_MARGIN_BYTES + needed - 1;
    const deps = { ...fetchDeps(), estimator: withSpace(free) };
    const error = await fetchMissingAudio(EN, deps).catch((e: CoreError) => e);
    expect(error).toMatchObject({
      code: 'LOW_STORAGE',
      details: { neededBytes: needed, freeBytes: free },
    });
    expect(await env.storage.listAudio()).toEqual([]);
  });

  test('an unknown module is MODULE_NOT_READY', async () => {
    expect(await codeOf(fetchMissingAudio('nope', fetchDeps()))).toBe('MODULE_NOT_READY');
  });
});

describe('removeModuleContent', () => {
  test('removes the record and its own audio but keeps audio shared with another module', async () => {
    await env.sync();
    const apt = (await audioOf(APT)).map((a) => a.path);
    const own = (await audioOf(EN)).map((a) => a.path).filter((p) => !apt.includes(p));
    expect(own.length).toBeGreaterThan(0);
    expect(apt.length).toBeGreaterThan(0);
    const result = await removeModuleContent(EN, env.storage);
    expect(result.removedAudio).toBe(own.length);
    expect(await isModulePlayable(EN, env.storage)).toBe(false);
    expect(await env.storage.listAudio()).toEqual([...apt].sort());
    expect(await isModulePlayable(APT, env.storage)).toBe(true);
  });

  test('the next sync reinstalls it, unless the module is in skipModules', async () => {
    await env.sync();
    await removeModuleContent(EN, env.storage);
    await env.sync({ skipModules: new Set([EN]) });
    expect(await isModulePlayable(EN, env.storage)).toBe(false);
    await env.sync();
    expect(await isModulePlayable(EN, env.storage)).toBe(true);
  });

  test('an unknown id removes nothing and does not throw', async () => {
    await env.sync();
    const before = await env.storage.listAudio();
    expect(await removeModuleContent('nope', env.storage)).toEqual({ removedAudio: 0 });
    expect(await env.storage.listAudio()).toEqual(before);
  });
});

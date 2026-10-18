import type {
  Manifest,
  ModuleBundle,
  PlacementBundle,
  PracticeItem,
} from '@shiksha/content/schema';
import { describe, expect, test } from 'vitest';
import type { BundleStorage } from '../storage.js';

const L = { hi: 'क', en: 'a' };
const AUDIO = 'audio/0123456789abcdef.mp3';
const HASH = 'a'.repeat(64);
const wordItem: PracticeItem = { id: 'q1', type: 'word_order', prompt: L, words: ['a', 'b'] };

const moduleBundle = (version: string): ModuleBundle => ({
  schema_version: 1,
  id: 'm1',
  version,
  track: 'english',
  title: L,
  hi_ratio: 0.5,
  lessons: [
    {
      id: 'l1',
      order: 1,
      topic: 't',
      level: 1,
      hi_ratio: 0.5,
      title: L,
      html: { hi: '<p>क</p>', en: '<p>a</p>' },
      audio: null,
      items: [wordItem],
    },
  ],
  test_out: null,
  audio: [{ path: AUDIO, sha256: HASH, bytes: 3 }],
});

const placementBundle = (version: string): PlacementBundle => ({
  schema_version: 1,
  version,
  sections: [
    {
      track: 'english',
      items: [wordItem],
      start_rules: [{ min_score: 0, start_lesson: 'l1' }],
    },
  ],
  audio: [],
});

const manifest: Manifest = {
  schema_version: 1,
  built_at: '2026-10-18T10:00:00.000Z',
  preview: false,
  tracks: [{ id: 'english', title: L, order: 1 }],
  modules: [],
  placement: null,
};

/** The behaviour every BundleStorage adapter (memory, IndexedDB, …) must have. */
export function describeBundleStorage(
  name: string,
  factory: () => BundleStorage | Promise<BundleStorage>,
): void {
  describe(`BundleStorage contract: ${name}`, () => {
    test('starts empty', async () => {
      const s = await factory();
      expect(await s.getManifest()).toBeNull();
      expect(await s.getModule('m1')).toBeNull();
      expect(await s.getPlacement()).toBeNull();
      expect(await s.listAudio()).toEqual([]);
    });

    test('round-trips the manifest', async () => {
      const s = await factory();
      await s.putManifest(manifest);
      expect(await s.getManifest()).toEqual(manifest);
    });

    test('stores, replaces and removes a module', async () => {
      const s = await factory();
      await s.putModule('m1', 'aaaaaaaaaaaa', moduleBundle('aaaaaaaaaaaa'));
      expect((await s.getModule('m1'))?.version).toBe('aaaaaaaaaaaa');
      await s.putModule('m1', 'bbbbbbbbbbbb', moduleBundle('bbbbbbbbbbbb'));
      expect(await s.getModule('m1')).toEqual({
        version: 'bbbbbbbbbbbb',
        bundle: moduleBundle('bbbbbbbbbbbb'),
      });
      await s.removeModule('m1');
      expect(await s.getModule('m1')).toBeNull();
    });

    test('stores and removes the placement bundle', async () => {
      const s = await factory();
      await s.putPlacement('aaaaaaaaaaaa', placementBundle('aaaaaaaaaaaa'));
      expect((await s.getPlacement())?.bundle).toEqual(placementBundle('aaaaaaaaaaaa'));
      await s.removePlacement();
      expect(await s.getPlacement()).toBeNull();
    });

    test('stores audio by path: has, get, list, remove', async () => {
      const s = await factory();
      expect(await s.hasAudio(AUDIO)).toBe(false);
      await s.putAudio(AUDIO, Uint8Array.of(1, 2, 3));
      expect(await s.hasAudio(AUDIO)).toBe(true);
      expect(await s.getAudio(AUDIO)).toEqual(Uint8Array.of(1, 2, 3));
      expect(await s.listAudio()).toEqual([AUDIO]);
      await s.removeAudio(AUDIO);
      expect(await s.hasAudio(AUDIO)).toBe(false);
      expect(await s.getAudio(AUDIO)).toBeNull();
      expect(await s.listAudio()).toEqual([]);
    });
  });
}

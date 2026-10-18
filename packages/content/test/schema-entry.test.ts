import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { manifestSchema, moduleBundleSchema, placementBundleSchema } from '../src/schema-entry.js';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

/** Follow every relative import from `entry`; collect the bare (package/node:) specifiers. */
function reach(entry: string): { files: string[]; external: string[] } {
  const files = new Set<string>();
  const external = new Set<string>();
  const queue = [resolve(srcDir, entry)];
  while (queue.length > 0) {
    const file = queue.pop() ?? '';
    if (files.has(file)) continue;
    files.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/\bfrom\s+'([^']+)'/g)) {
      const spec = m[1] ?? '';
      if (spec.startsWith('.')) queue.push(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
      else external.add(spec);
    }
  }
  return { files: [...files], external: [...external] };
}

const L = { hi: 'क', en: 'a' };
const AUDIO = 'audio/0123456789abcdef.mp3';
const HASH = 'a'.repeat(64);
const wordItem = { id: 'q1', type: 'word_order', prompt: L, words: ['I', 'am'] };
const listenItem = (audio: string): object => ({
  id: 'q2',
  type: 'listen_choose',
  prompt: L,
  audio,
  options: [
    { id: 'a', text: L, correct: true },
    { id: 'b', text: L, why_wrong: L },
  ],
});

const lesson = (over: object = {}): object => ({
  id: 'ef1-01',
  order: 1,
  topic: 'greetings',
  level: 1,
  hi_ratio: 0.8,
  title: L,
  html: { hi: '<p>क</p>', en: '<p>a</p>' },
  audio: null,
  items: [wordItem],
  ...over,
});

const bundle = (over: object = {}): Record<string, unknown> => ({
  schema_version: 1,
  id: 'english-foundation-1',
  version: 'a1b2c3d4e5f6',
  track: 'english',
  title: L,
  hi_ratio: 0.8,
  lessons: [lesson()],
  test_out: null,
  audio: [],
  ...over,
});

const listed = [{ path: AUDIO, sha256: HASH, bytes: 1 }];
const ok = (schema: { safeParse(v: unknown): { success: boolean } }, v: unknown): boolean =>
  schema.safeParse(v).success;
const errorText = (schema: { safeParse(v: unknown): { error?: unknown } }, v: unknown): string =>
  JSON.stringify((schema.safeParse(v).error as { issues?: unknown } | undefined)?.issues ?? []);

describe('schema entry is browser-safe', () => {
  test('reaches no node: module and no bundler dependency', () => {
    const { files, external } = reach('schema-entry.ts');
    expect(files.length).toBeGreaterThan(3);
    expect(external).toEqual(['zod']);
  });
});

describe('moduleBundleSchema', () => {
  test('parses a valid bundle', () => {
    expect(ok(moduleBundleSchema, bundle())).toBe(true);
  });

  test('rejects schema_version 2', () => {
    expect(ok(moduleBundleSchema, bundle({ schema_version: 2 }))).toBe(false);
  });

  test('rejects a 13-character version', () => {
    expect(ok(moduleBundleSchema, bundle({ version: 'a1b2c3d4e5f6a' }))).toBe(false);
  });

  test('rejects an unknown key (strictness)', () => {
    expect(ok(moduleBundleSchema, bundle({ surprise: true }))).toBe(false);
  });

  test('rejects an audio path outside audio/', () => {
    const audio = [{ path: '../x.mp3', sha256: HASH, bytes: 1 }];
    expect(ok(moduleBundleSchema, bundle({ audio }))).toBe(false);
  });

  test('rejects an item that breaks the practiceItem rules (two correct options)', () => {
    const twoCorrect = {
      ...listenItem(AUDIO),
      options: [
        { id: 'a', text: L, correct: true },
        { id: 'b', text: L, correct: true },
      ],
    };
    const bad = bundle({ lessons: [lesson({ items: [twoCorrect] })], audio: listed });
    expect(ok(moduleBundleSchema, bad)).toBe(false);
  });

  test('rejects a lesson audio reference that is not listed in audio[]', () => {
    const bad = bundle({ lessons: [lesson({ audio: { hi: AUDIO } })] });
    expect(errorText(moduleBundleSchema, bad)).toContain('not listed');
  });

  test('rejects an item audio reference outside audio/', () => {
    const bad = bundle({ lessons: [lesson({ items: [listenItem('x.mp3')] })] });
    expect(errorText(moduleBundleSchema, bad)).toContain('audio/');
  });

  test('rejects a test_out audio reference that is not listed', () => {
    const bad = bundle({ test_out: { pass_mark: 0.8, items: [listenItem(AUDIO)] } });
    expect(errorText(moduleBundleSchema, bad)).toContain('not listed');
  });

  test('parses a bundle whose references are all listed', () => {
    const good = bundle({
      lessons: [lesson({ audio: { hi: AUDIO }, items: [wordItem, listenItem(AUDIO)] })],
      test_out: { pass_mark: 0.8, items: [listenItem(AUDIO)] },
      audio: listed,
    });
    expect(ok(moduleBundleSchema, good)).toBe(true);
  });
});

describe('placementBundleSchema', () => {
  const section = (items: object[]): object => ({
    track: 'english',
    items,
    start_rules: [{ min_score: 0, start_lesson: 'ef1-01' }],
  });
  const placement = (items: object[], audio: object[] = []): object => ({
    schema_version: 1,
    version: 'a1b2c3d4e5f6',
    sections: [section(items)],
    audio,
  });

  test('parses a valid placement bundle', () => {
    expect(ok(placementBundleSchema, placement([wordItem]))).toBe(true);
  });

  test('rejects an item audio reference that is not listed', () => {
    expect(errorText(placementBundleSchema, placement([listenItem(AUDIO)]))).toContain(
      'not listed',
    );
  });

  test('parses when the reference is listed', () => {
    expect(ok(placementBundleSchema, placement([listenItem(AUDIO)], listed))).toBe(true);
  });
});

describe('manifestSchema', () => {
  const entry = (over: object = {}): object => ({
    id: 'english-foundation-1',
    track: 'english',
    title: L,
    order: 1,
    version: 'a1b2c3d4e5f6',
    file: 'modules/english-foundation-1.a1b2c3d4e5f6.json',
    sha256: HASH,
    bytes: 100,
    audio_bytes: 0,
    lessons: [{ id: 'ef1-01', order: 1, title: L }],
    ...over,
  });
  const manifest = (over: object = {}): Record<string, unknown> => ({
    schema_version: 1,
    built_at: '2026-10-18T10:00:00.000Z',
    preview: false,
    tracks: [{ id: 'english', title: L, order: 1 }],
    modules: [entry()],
    placement: null,
    ...over,
  });

  test('parses a valid manifest and accepts the empty modules list', () => {
    expect(ok(manifestSchema, manifest())).toBe(true);
    expect(ok(manifestSchema, manifest({ modules: [] }))).toBe(true);
  });

  test('rejects a module file path with ..', () => {
    const bad = manifest({ modules: [entry({ file: 'modules/../x.a1b2c3d4e5f6.json' })] });
    expect(ok(manifestSchema, bad)).toBe(false);
  });

  test('rejects a placement file path outside the expected pattern', () => {
    const placement = {
      file: '../placement.a1b2c3d4e5f6.json',
      version: 'a1b2c3d4e5f6',
      sha256: HASH,
      bytes: 1,
      audio_bytes: 0,
    };
    expect(ok(manifestSchema, manifest({ placement }))).toBe(false);
  });

  test('rejects schema_version 2 and a non-ISO built_at', () => {
    expect(ok(manifestSchema, manifest({ schema_version: 2 }))).toBe(false);
    expect(ok(manifestSchema, manifest({ built_at: 'yesterday' }))).toBe(false);
  });
});

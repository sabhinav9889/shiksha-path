import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  manifestSchema,
  moduleBundleSchema,
  placementBundleSchema,
  type AudioEntry,
  type Manifest,
} from '@shiksha/content/schema';
import { describe, expect, test } from 'vitest';
import { buildContent, makeContentFixture } from './helpers/content-fixture.js';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8')) as unknown;

async function checkAudio(outDir: string, entries: AudioEntry[]): Promise<void> {
  for (const entry of entries) {
    const bytes = await readFile(join(outDir, entry.path));
    expect(entry.bytes).toBe(bytes.length);
    expect(entry.sha256).toBe(sha256(bytes));
    expect(parse(entry.path).name).toBe(entry.sha256.slice(0, 16));
  }
}

/** Parse every file of a build with the shared schemas and cross-check sizes and hashes. */
async function parseBuild(outDir: string): Promise<{ manifest: Manifest; audio: AudioEntry[] }> {
  const manifest = manifestSchema.parse(await readJson(join(outDir, 'manifest.json')));
  const audio: AudioEntry[] = [];
  for (const m of manifest.modules) {
    const bytes = await readFile(join(outDir, m.file));
    expect(m.bytes).toBe(bytes.length);
    expect(m.sha256).toBe(sha256(bytes));
    const bundle = moduleBundleSchema.parse(JSON.parse(bytes.toString('utf8')));
    expect([bundle.id, bundle.version]).toEqual([m.id, m.version]);
    audio.push(...bundle.audio);
  }
  if (manifest.placement) {
    const bytes = await readFile(join(outDir, manifest.placement.file));
    expect(manifest.placement.bytes).toBe(bytes.length);
    expect(manifest.placement.sha256).toBe(sha256(bytes));
    const bundle = placementBundleSchema.parse(JSON.parse(bytes.toString('utf8')));
    expect(bundle.version).toBe(manifest.placement.version);
    audio.push(...bundle.audio);
  }
  await checkAudio(outDir, audio);
  return { manifest, audio };
}

describe('the content builder (producer) and the shared schemas (consumer) agree', () => {
  test("the repo's real content parses, with the three model recordings stored once each", async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'sample-out-'));
    await buildContent(fileURLToPath(new URL('../../../content', import.meta.url)), outDir);
    const { manifest, audio } = await parseBuild(outDir);
    expect(manifest.modules.length).toBeGreaterThanOrEqual(2);
    expect(manifest.placement).not.toBeNull();
    // The "Say it aloud" lesson: each listening and speaking item shares one of three clips.
    expect(audio).toHaveLength(3);
    expect(new Set(audio.map((a) => a.path)).size).toBe(3);
    expect(await readdir(join(outDir, 'audio'))).toHaveLength(3);
  });

  test('a fixture with fake audio parses, and shared audio is stored once', async () => {
    const { outDir } = await makeContentFixture();
    const { manifest, audio } = await parseBuild(outDir);
    expect(manifest.modules.map((m) => m.id)).toEqual(['english-foundation-1', 'aptitude-1']);
    expect(manifest.modules[0]?.lessons.map((l) => l.id)).toEqual(['ef1-01', 'ef1-02', 'ef1-03']);
    expect(audio.length).toBe(3);
    expect(new Set(audio.map((a) => a.path)).size).toBe(2);
    expect(await readdir(join(outDir, 'audio'))).toHaveLength(2);
  });

  test('rebuild() applies a change and leaves only the files of the new build', async () => {
    const fixture = await makeContentFixture();
    const before = await parseBuild(fixture.outDir);
    await fixture.rebuild((files) => {
      files['modules/aptitude-1/audio/shared.mp3'] = new TextEncoder().encode('different-bytes');
    });
    const after = await parseBuild(fixture.outDir);
    const paths = (audio: AudioEntry[]): string[] => audio.map((a) => a.path).sort();
    expect(paths(after.audio)).not.toEqual(paths(before.audio));
    expect(await readdir(join(fixture.outDir, 'audio'))).toHaveLength(3);
  });
});

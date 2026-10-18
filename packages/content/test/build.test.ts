import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { renderMarkdown, type ModuleBundle } from '../src/bundle.js';
import { selectForBuild, writeBuild, type BuildResult } from '../src/build.js';
import { loadContent } from '../src/load.js';
import { makeContentDir, type FileMap } from './helpers/content-dir.js';
import { APT, EF1, lessonMd, listenItem, validFixture, wordItem } from './helpers/fixture.js';

const NOW = new Date('2026-10-18T10:00:00Z');
const MIB = 1024 * 1024;

async function build(files: FileMap, preview = false): Promise<BuildResult & { out: string }> {
  const { content } = await loadContent(await makeContentDir(files));
  const out = await mkdtemp(join(tmpdir(), 'out-'));
  const result = await writeBuild(selectForBuild(content, { preview }), out, { preview, now: NOW });
  return { ...result, out };
}

async function readBundle(out: string, file: string): Promise<ModuleBundle> {
  return JSON.parse(await readFile(join(out, file), 'utf8')) as ModuleBundle;
}

const pendingApt = (): FileMap => ({
  ...validFixture(),
  [`${APT}/lessons/02-x.md`]: lessonMd({
    id: 'apt-02',
    track: 'aptitude',
    module: 'aptitude-1',
    order: 2,
    review: 'pending',
  }),
});

describe('writeBuild', () => {
  test('writes manifest with both modules and placement', async () => {
    const { manifest, out } = await build(validFixture());
    expect(manifest.modules.map((m) => m.id)).toEqual(['english-foundation-1', 'aptitude-1']);
    expect(manifest.tracks.map((t) => t.id)).toEqual(['english', 'aptitude']);
    expect(manifest.placement?.file).toMatch(/^placement\.[0-9a-f]{12}\.json$/);
    expect(manifest.built_at).toBe(NOW.toISOString());
    const onDisk = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')) as unknown;
    expect(onDisk).toEqual(manifest);
  });

  test('excludes a pending lesson normally and includes it with preview', async () => {
    const normal = await build(pendingApt());
    const apt = normal.manifest.modules.find((m) => m.id === 'aptitude-1');
    expect(apt?.lessons.map((l) => l.id)).toEqual(['apt-01']);
    const preview = await build(pendingApt(), true);
    const aptPreview = preview.manifest.modules.find((m) => m.id === 'aptitude-1');
    expect(aptPreview?.lessons.map((l) => l.id)).toEqual(['apt-01', 'apt-02']);
    expect(preview.manifest.preview).toBe(true);
  });

  test('omits a module whose lessons are all pending', async () => {
    const files = validFixture();
    files[`${APT}/lessons/01-patterns.md`] = lessonMd({
      id: 'apt-01',
      track: 'aptitude',
      module: 'aptitude-1',
      order: 1,
      review: 'pending',
    });
    const { manifest } = await build(files);
    expect(manifest.modules.map((m) => m.id)).toEqual(['english-foundation-1']);
  });

  test('test_out is null when test-out is pending', async () => {
    const files = validFixture();
    files[`${APT}/test-out.yaml`] = `review: pending\nitems:\n${wordItem('t1')}\n`;
    const { manifest, out } = await build(files);
    const apt = manifest.modules.find((m) => m.id === 'aptitude-1');
    expect((await readBundle(out, apt?.file ?? '')).test_out).toBeNull();
  });

  test('placement is omitted when pending', async () => {
    const files = validFixture();
    files['placement/placement.yaml'] = String(files['placement/placement.yaml']).replace(
      'review: approved',
      'review: pending',
    );
    expect((await build(files)).manifest.placement).toBeNull();
  });

  test('version is stable across builds', async () => {
    const a = await build(validFixture());
    const b = await build(validFixture());
    expect(a.manifest.modules).toEqual(b.manifest.modules);
    for (const m of a.manifest.modules) {
      const bytesA = await readFile(join(a.out, m.file));
      const bytesB = await readFile(join(b.out, m.file));
      expect(bytesA.equals(bytesB)).toBe(true);
    }
  });

  test('version changes when lesson text changes', async () => {
    const files = validFixture();
    const before = await build(files);
    files[`${APT}/lessons/01-patterns.md`] = String(files[`${APT}/lessons/01-patterns.md`]).replace(
      'Hello! This is lesson 1.',
      'Hello! This is lesson one.',
    );
    const after = await build(files);
    const v = (r: BuildResult, id: string): string | undefined =>
      r.manifest.modules.find((m) => m.id === id)?.version;
    expect(v(after, 'aptitude-1')).not.toBe(v(before, 'aptitude-1'));
    expect(v(after, 'english-foundation-1')).toBe(v(before, 'english-foundation-1'));
  });

  test('manifest sha256 and bytes match the written file', async () => {
    const { manifest, out } = await build(validFixture());
    for (const m of manifest.modules) {
      const bytes = await readFile(join(out, m.file));
      expect(m.file).toBe(`modules/${m.id}.${m.version}.json`);
      expect(m.bytes).toBe(bytes.length);
      expect(m.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  test('audio is content-addressed and deduplicated', async () => {
    const files = validFixture();
    files[`${APT}/audio/same.mp3`] = Buffer.from('fake-mp3-bytes');
    const items = [...['q1', 'q2', 'q3', 'q4'].map(wordItem), listenItem('q5', 'audio/same.mp3')];
    files[`${APT}/lessons/01-patterns.md`] = lessonMd({
      id: 'apt-01',
      track: 'aptitude',
      module: 'aptitude-1',
      order: 1,
      items,
    });
    const { manifest, out } = await build(files);
    const audioFiles = await readdir(join(out, 'audio'));
    expect(audioFiles).toEqual([expect.stringMatching(/^[0-9a-f]{16}\.mp3$/)]);
    const ef1 = await readBundle(out, manifest.modules[0]?.file ?? '');
    const item = ef1.lessons[0]?.items.find((i) => i.id === 'q5');
    expect(item?.type === 'listen_choose' ? item.audio : '').toBe(`audio/${audioFiles[0]}`);
    expect(ef1.audio).toEqual([
      expect.objectContaining({ path: `audio/${audioFiles[0]}`, bytes: 14 }),
    ]);
  });

  test('lesson html is rendered and hi_ratio falls back to the module', async () => {
    const { manifest, out } = await build(validFixture());
    const ef1 = await readBundle(out, manifest.modules[0]?.file ?? '');
    expect(ef1.lessons[0]?.html.hi).toContain('<p>');
    expect(ef1.lessons[0]?.html.en).toContain('Hello! This is lesson 1.');
    expect(ef1.lessons[0]?.hi_ratio).toBe(0.8);
  });

  test('lesson-level audio is rewritten to its published path', async () => {
    const files = validFixture();
    files[`${APT}/audio/intro.mp3`] = Buffer.from('intro-audio');
    files[`${APT}/lessons/01-patterns.md`] = lessonMd({
      id: 'apt-01',
      track: 'aptitude',
      module: 'aptitude-1',
      order: 1,
      audio: 'audio/intro.mp3',
    });
    const { manifest, out } = await build(files);
    const apt = await readBundle(
      out,
      manifest.modules.find((m) => m.id === 'aptitude-1')?.file ?? '',
    );
    expect(apt.lessons[0]?.audio).toEqual({
      hi: expect.stringMatching(/^audio\/[0-9a-f]{16}\.mp3$/),
    });
    expect(apt.lessons.find((l) => l.id === 'apt-01')?.audio?.en).toBeUndefined();
  });

  test('warns above 5 MiB', async () => {
    const files = validFixture();
    files[`${EF1}/audio/hello.mp3`] = Buffer.alloc(6 * MIB);
    const { issues } = await build(files);
    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('english-foundation-1'),
      }),
    ]);
  });
});

describe('renderMarkdown', () => {
  test('escapes raw HTML so lesson text cannot inject scripts', () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  test('drops javascript: links but keeps normal links', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('javascript:');
    expect(renderMarkdown('[ok](https://example.org)')).toContain('href="https://example.org"');
  });
});

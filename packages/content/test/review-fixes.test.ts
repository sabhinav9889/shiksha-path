import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { renderMarkdown, type PlacementBundle } from '../src/bundle.js';
import { selectForBuild, writeBuild } from '../src/build.js';
import { runCli } from '../src/cli.js';
import type { ContentIssue } from '../src/issues.js';
import { loadContent } from '../src/load.js';
import { validateContent } from '../src/validate.js';
import { findExactPath } from '../src/validate-audio.js';
import { makeContentDir, type FileMap } from './helpers/content-dir.js';
import { APT, EF1, lessonMd, listenItem, validFixture, wordItem } from './helpers/fixture.js';

const BOM = String.fromCodePoint(0xfeff);

async function issuesFor(files: FileMap, preview = false): Promise<ContentIssue[]> {
  const { content, issues } = await loadContent(await makeContentDir(files));
  return [...issues, ...(await validateContent(content, { preview }))];
}
const errorText = (issues: ContentIssue[]): string =>
  issues
    .filter((i) => i.severity === 'error')
    .map((i) => `${i.file}: ${i.message}`)
    .join('\n');

describe('C1: lesson HTML cannot carry script URLs', () => {
  test.each([
    '[a](java&#115;cript:alert(1))',
    '[a](&#106;avascript:alert(1))',
    '[a](javascript&colon;alert(1))',
    '[a](&#x6A;avascript:alert(1))',
    '[a](JaVaScRiPt:alert(1))',
    '[a](<javascript:alert(1)>)',
    '[a](vbscript:msgbox(1))',
    '[a](data:text/html,<script>alert(1)</script>)',
  ])('%s renders as plain text', (md) => {
    const html = renderMarkdown(md);
    expect(html).not.toMatch(/href/i);
    expect(html).toContain('a');
  });

  test('keeps https, mailto, relative and anchor links', () => {
    expect(renderMarkdown('[x](https://example.org/a)')).toContain('href="https://example.org/a"');
    expect(renderMarkdown('[x](mailto:help@example.org)')).toContain(
      'href="mailto:help@example.org"',
    );
    expect(renderMarkdown('[x](../lessons/02.md)')).toContain('href="../lessons/02.md"');
    expect(renderMarkdown('[x](#part-2)')).toContain('href="#part-2"');
  });

  test('images: only local paths; remote and protocol-relative images are dropped', () => {
    expect(renderMarkdown('![pic](images/a.png)')).toContain('<img src="images/a.png"');
    expect(renderMarkdown('![pic](https://tracker.example/p.png)')).not.toContain('<img');
    expect(renderMarkdown('![pic](//tracker.example/p.png)')).not.toContain('<img');
    expect(renderMarkdown('![pic](java&#115;cript:x)')).not.toContain('<img');
  });
});

describe('I2: every YAML file tolerates BOM + CRLF', () => {
  test('BOM + CRLF in all .yaml files loads with no issues', async () => {
    const files = Object.fromEntries(
      Object.entries(validFixture()).map(([path, data]) =>
        path.endsWith('.yaml') ? [path, BOM + String(data).replace(/\n/g, '\r\n')] : [path, data],
      ),
    );
    expect(await issuesFor(files)).toEqual([]);
  });
});

const aptLessonWithAudio = (ref: string): FileMap => ({
  ...validFixture(),
  [`${APT}/lessons/02-x.md`]: lessonMd({
    id: 'apt-02',
    track: 'aptitude',
    module: 'aptitude-1',
    order: 2,
    audio: ref,
  }),
});

describe('I3/I4: audio paths behave the same on every OS', () => {
  test('backslash in an audio path is rejected', async () => {
    const files = {
      ...aptLessonWithAudio(`audio${String.fromCharCode(92)}x.mp3`),
      [`${APT}/audio/x.mp3`]: 'x',
    };
    expect(errorText(await issuesFor(files))).toContain('use "/"');
  });

  test('a directory named like an audio file is rejected', async () => {
    const files = { ...aptLessonWithAudio('audio/d.mp3'), [`${APT}/audio/d.mp3/inner.txt`]: 'x' };
    expect(errorText(await issuesFor(files))).toContain('not a file');
  });

  test('folder-name case is checked even on a case-insensitive filesystem', async () => {
    const tree: Record<string, string[]> = { '/m': ['audio'], '/m/audio': ['x.mp3'] };
    const caseInsensitive = async (dir: string): Promise<string[]> =>
      tree[dir.toLowerCase()] ?? Promise.reject(new Error('ENOENT'));
    expect(await findExactPath('/m', ['Audio', 'x.mp3'], caseInsensitive)).toBe(false);
    expect(await findExactPath('/m', ['audio', 'X.mp3'], caseInsensitive)).toBe(false);
    expect(await findExactPath('/m', ['audio', 'x.mp3'], caseInsensitive)).toBe(true);
  });
});

describe('I5: placement audio is listed and verifiable', () => {
  test('placement bundle lists its audio; manifest has bytes and audio_bytes', async () => {
    const files = validFixture();
    const listen = listenItem('p3', 'audio/p.mp3').replace(/^/gm, '    ');
    const yaml = String(files['placement/placement.yaml']);
    files['placement/placement.yaml'] = yaml.replace(
      '    start_rules:',
      `${listen}\n    start_rules:`,
    );
    files['placement/audio/p.mp3'] = Buffer.from('placement-audio');
    const { content } = await loadContent(await makeContentDir(files));
    const out = await mkdtemp(join(tmpdir(), 'out-'));
    const now = new Date('2026-10-18T10:00:00Z');
    const { manifest } = await writeBuild(selectForBuild(content, { preview: false }), out, {
      preview: false,
      now,
    });
    const file = manifest.placement?.file ?? '';
    const bundle = JSON.parse(await readFile(join(out, file), 'utf8')) as PlacementBundle;
    expect(bundle.audio).toEqual([expect.objectContaining({ bytes: 15 })]);
    expect(manifest.placement?.audio_bytes).toBe(15);
    expect(manifest.placement?.bytes).toBe((await readFile(join(out, file))).length);
  });
});

describe('I6: ids and orders that the app relies on are unique', () => {
  test('duplicate item ids in a test-out', async () => {
    const files = validFixture();
    files[`${APT}/test-out.yaml`] =
      `review: approved\nitems:\n${wordItem('t1')}\n${wordItem('t1')}\n`;
    expect(errorText(await issuesFor(files))).toContain('t1');
  });

  test('duplicate item ids across placement sections', async () => {
    const files = validFixture();
    files['placement/placement.yaml'] = String(files['placement/placement.yaml']).replace(
      'p2',
      'p1',
    );
    expect(errorText(await issuesFor(files))).toContain('p1');
  });

  test('duplicate track ids', async () => {
    const files = validFixture();
    files['tracks.yaml'] = String(files['tracks.yaml']).replace('id: aptitude', 'id: english');
    expect(errorText(await issuesFor(files))).toContain('english');
  });

  test('duplicate module order', async () => {
    const files = validFixture();
    files[`${APT}/module.yaml`] = String(files[`${APT}/module.yaml`]).replace(
      'order: 2',
      'order: 1',
    );
    expect(errorText(await issuesFor(files))).toContain('order 1');
  });
});

async function cli(args: string[]): Promise<{ code: number; err: string }> {
  const err: string[] = [];
  const code = await runCli(args, { log: () => undefined, error: (m) => err.push(m) });
  return { code, err: err.join('\n') };
}

describe('I7: the CLI never deletes something that is not a previous build', () => {
  test('refuses a non-empty --out folder that has no manifest.json', async () => {
    const content = await makeContentDir(validFixture());
    const out = await mkdtemp(join(tmpdir(), 'docs-'));
    await writeFile(join(out, 'important.md'), 'keep me');
    const r = await cli(['--content', content, '--out', out]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('refusing');
    expect(existsSync(join(out, 'important.md'))).toBe(true);
  });

  test('a failing build keeps the previous build in place', async () => {
    const content = await makeContentDir(validFixture());
    const out = join(await mkdtemp(join(tmpdir(), 'out-')), 'dist');
    expect((await cli(['--content', content, '--out', out])).code).toBe(0);
    const before = await readFile(join(out, 'manifest.json'), 'utf8');
    const audio = join(content, EF1, 'audio', 'hello.mp3');
    await chmod(audio, 0o000);
    try {
      const r = await cli(['--content', content, '--out', out]);
      expect(r.code).toBe(1);
      expect(await readFile(join(out, 'manifest.json'), 'utf8')).toBe(before);
    } finally {
      await chmod(audio, 0o644);
    }
  });
});

describe('I8: pending placement or test-out is reported, not silently dropped', () => {
  test('warns when the placement test or a test-out is excluded', async () => {
    const files = validFixture();
    const replace = (path: string): void => {
      files[path] = String(files[path]).replace('review: approved', 'review: pending');
    };
    replace('placement/placement.yaml');
    replace(`${APT}/test-out.yaml`);
    const warnings = (await issuesFor(files)).filter((i) => i.severity === 'warning');
    expect(warnings.map((w) => `${w.file}: ${w.message}`)).toEqual(
      expect.arrayContaining([
        'placement/placement.yaml: placement test excluded from build (review: pending)',
        `${APT}/test-out.yaml: test-out excluded from build (review: pending)`,
      ]),
    );
  });
});

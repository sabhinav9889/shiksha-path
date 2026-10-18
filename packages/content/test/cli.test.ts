import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { runCli } from '../src/cli.js';
import { makeContentDir } from './helpers/content-dir.js';
import { APT, lessonMd, validFixture } from './helpers/fixture.js';

interface Run {
  code: number;
  out: string[];
  err: string[];
}

async function cli(args: string[]): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, { log: (m) => out.push(m), error: (m) => err.push(m) });
  return { code, out, err };
}

async function dirs(files = validFixture()): Promise<{ content: string; out: string }> {
  const content = await makeContentDir(files);
  const out = join(await mkdtemp(join(tmpdir(), 'cli-out-')), 'dist');
  return { content, out };
}

describe('runCli', () => {
  test('returns 1 and prints file: message for invalid content, writing nothing', async () => {
    const files = validFixture();
    files[`${APT}/module.yaml`] = 'id: aptitude-1\n';
    const { content, out } = await dirs(files);
    const r = await cli(['--content', content, '--out', out]);
    expect(r.code).toBe(1);
    expect(r.err.join('\n')).toMatch(/^error modules\/aptitude-1\/module\.yaml track: /m);
    expect(existsSync(out)).toBe(false);
  });

  test('returns 0 and writes manifest.json for the valid fixture', async () => {
    const { content, out } = await dirs();
    const r = await cli(['--content', content, '--out', out]);
    expect(r.code).toBe(0);
    expect(r.out.at(-1)).toBe(`Built 2 modules, 3 lessons → ${out}`);
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')) as {
      modules: unknown[];
    };
    expect(manifest.modules).toHaveLength(2);
  });

  test('--check writes nothing', async () => {
    const { content, out } = await dirs();
    const r = await cli(['--content', content, '--out', out, '--check']);
    expect(r.code).toBe(0);
    expect(r.out.at(-1)).toBe('Content OK: 2 modules, 3 lessons');
    expect(existsSync(out)).toBe(false);
  });

  test('removes stale files from a previous build', async () => {
    const { content, out } = await dirs();
    await cli(['--content', content, '--out', out]);
    await writeFile(join(out, 'stale.json'), '{}');
    await cli(['--content', content, '--out', out]);
    expect(await readdir(out)).not.toContain('stale.json');
    expect(await readdir(out)).toContain('manifest.json');
  });

  test('--preview includes pending lessons', async () => {
    const files = validFixture();
    files[`${APT}/lessons/02-x.md`] = lessonMd({
      id: 'apt-02',
      track: 'aptitude',
      module: 'aptitude-1',
      order: 2,
      review: 'pending',
    });
    const { content, out } = await dirs(files);
    const normal = await cli(['--content', content, '--out', out]);
    expect(normal.out.join('\n')).toContain('warning modules/aptitude-1/lessons/02-x.md');
    expect(normal.out.at(-1)).toContain('3 lessons');
    const preview = await cli(['--content', content, '--out', out, '--preview']);
    expect(preview.out.at(-1)).toContain('4 lessons');
  });

  test('refuses an out dir that contains the content', async () => {
    const { content } = await dirs();
    const r = await cli(['--content', content, '--out', join(content, '..')]);
    expect(r.code).toBe(1);
    expect(r.err.join()).toContain('refusing');
    expect(existsSync(join(content, 'tracks.yaml'))).toBe(true);
  });

  test('unknown flag returns 1; --help returns 0', async () => {
    expect((await cli(['--nope'])).code).toBe(1);
    const help = await cli(['--help']);
    expect(help.code).toBe(0);
    expect(help.out.join()).toContain('--preview');
  });
});

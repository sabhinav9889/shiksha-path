import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { selectForBuild, writeBuild } from '../src/build.js';
import { runCli } from '../src/cli.js';
import { loadContent } from '../src/load.js';
import { validateContent } from '../src/validate.js';
import { makeContentDir, type FileMap } from './helpers/content-dir.js';
import { APT, lessonMd, validFixture } from './helpers/fixture.js';

const SECRET = 'TOP-SECRET-TOKEN-123';

async function scratch(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/** A content tree whose `audio/leak.mp3` is a symlink to `target`. */
async function treeWithAudioLink(target: string): Promise<string> {
  const files: FileMap = {
    ...validFixture(),
    [`${APT}/lessons/02-x.md`]: lessonMd({
      id: 'apt-02',
      track: 'aptitude',
      module: 'aptitude-1',
      order: 2,
      audio: 'audio/leak.mp3',
    }),
  };
  const root = await makeContentDir(files);
  await mkdir(join(root, APT, 'audio'), { recursive: true });
  await symlink(target, join(root, APT, 'audio', 'leak.mp3'));
  return root;
}

async function outsideSecret(): Promise<string> {
  const file = join(await scratch('secret-'), 'secret.txt');
  await writeFile(file, SECRET);
  return file;
}

describe('audio symlinks cannot reach outside the content folder', () => {
  test('validation reports a symlink that points outside its folder', async () => {
    const root = await treeWithAudioLink(await outsideSecret());
    const { content } = await loadContent(root);
    const issues = await validateContent(content, { preview: false });
    expect(issues.map((i) => i.message).join('\n')).toContain('outside');
  });

  test('the build itself refuses it, even without validation (writeBuild is exported)', async () => {
    const root = await treeWithAudioLink(await outsideSecret());
    const { content } = await loadContent(root);
    const out = await scratch('out-');
    const now = new Date('2026-10-18T10:00:00Z');
    await expect(
      writeBuild(selectForBuild(content, { preview: false }), out, { preview: false, now }),
    ).rejects.toThrow(/outside/);
  });

  test('the CLI fails and the secret never reaches the output', async () => {
    const root = await treeWithAudioLink(await outsideSecret());
    const out = join(await scratch('cli-'), 'dist');
    const err: string[] = [];
    const code = await runCli(['--content', root, '--out', out], {
      log: () => undefined,
      error: (m) => err.push(m),
    });
    expect(code).toBe(1);
    expect(err.join('\n')).toContain('outside');
    expect(existsSync(out)).toBe(false);
  });

  test('a symlinked audio folder pointing outside is rejected too', async () => {
    const outside = await scratch('outside-');
    await writeFile(join(outside, 'leak.mp3'), SECRET);
    const root = await makeContentDir({
      ...validFixture(),
      [`${APT}/lessons/02-x.md`]: lessonMd({
        id: 'apt-02',
        track: 'aptitude',
        module: 'aptitude-1',
        order: 2,
        audio: 'media/leak.mp3',
      }),
    });
    await symlink(outside, join(root, APT, 'media'));
    const { content } = await loadContent(root);
    const issues = await validateContent(content, { preview: false });
    expect(issues.map((i) => i.message).join('\n')).toContain('outside');
  });

  test('a symlink to another file inside the same module folder is allowed', async () => {
    const root = await treeWithAudioLink('placeholder');
    await writeFile(join(root, APT, 'audio', 'real.mp3'), 'real-audio');
    await rm(join(root, APT, 'audio', 'leak.mp3'), { force: true });
    await symlink(join(root, APT, 'audio', 'real.mp3'), join(root, APT, 'audio', 'leak.mp3'));
    const { content } = await loadContent(root);
    expect(await validateContent(content, { preview: false })).toEqual([]);
  });
});

async function cli(content: string, out: string): Promise<{ code: number; err: string }> {
  const err: string[] = [];
  const code = await runCli(['--content', content, '--out', out], {
    log: () => undefined,
    error: (m) => err.push(m),
  });
  return { code, err: err.join('\n') };
}

describe('--out only replaces a real previous build', () => {
  async function webAppFolder(manifest: string): Promise<string> {
    const dir = await scratch('webapp-');
    await mkdir(join(dir, 'icons'));
    await writeFile(join(dir, 'manifest.json'), manifest);
    await writeFile(join(dir, 'index.html'), 'keep me');
    await writeFile(join(dir, 'icons', 'a.png'), 'icon');
    return dir;
  }

  test.each([
    ['a web-app manifest', '{"name":"my pwa","start_url":"/"}'],
    ['invalid JSON', '{not json'],
    ['a JSON array', '[]'],
    ['schema_version without modules', '{"schema_version":1}'],
    ['modules that is not a list', '{"schema_version":1,"modules":{}}'],
  ])('refuses a folder whose manifest.json is %s', async (_name, manifest) => {
    const content = await makeContentDir(validFixture());
    const dir = await webAppFolder(manifest);
    const r = await cli(content, dir);
    expect(r.code).toBe(1);
    expect(r.err).toContain('refusing');
    expect(await readFile(join(dir, 'index.html'), 'utf8')).toBe('keep me');
    expect(existsSync(join(dir, 'icons', 'a.png'))).toBe(true);
  });

  test('still replaces a genuine previous build', async () => {
    const content = await makeContentDir(validFixture());
    const out = join(await scratch('prev-'), 'dist');
    expect((await cli(content, out)).code).toBe(0);
    await writeFile(join(out, 'stale.json'), '{}');
    expect((await cli(content, out)).code).toBe(0);
    expect(existsSync(join(out, 'stale.json'))).toBe(false);
  });

  test('still builds into an empty or missing folder', async () => {
    const content = await makeContentDir(validFixture());
    expect((await cli(content, await scratch('empty-'))).code).toBe(0);
    expect((await cli(content, join(await scratch('missing-'), 'dist'))).code).toBe(0);
  });
});

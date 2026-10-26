import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../package-submission.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
let work: string;
let repo: string;

const git = (...args: string[]): string =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const run = (...args: string[]) =>
  spawnSync('node', [SCRIPT, '--repo', repo, ...args], { cwd: ROOT, encoding: 'utf8' });

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'shiksha-package-'));
  repo = join(work, 'project');
  mkdirSync(repo);
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  git('config', 'user.email', 'dev@example.org');
  git('config', 'user.name', 'Dev');
  writeFileSync(join(repo, 'README.md'), '# demo\n');
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\n.env\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'first commit');
  writeFileSync(join(repo, 'two.txt'), 'two\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'second commit');
  mkdirSync(join(repo, 'node_modules'));
  writeFileSync(join(repo, 'node_modules', 'big.js'), 'x');
  writeFileSync(join(repo, '.env'), 'NOT_A_REAL_SECRET=1\n'); // ignored: must not be packaged
});

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('the submission packager', () => {
  test('--help describes the options and needs no repository', () => {
    const out = spawnSync('node', [SCRIPT, '--help'], { encoding: 'utf8' });
    expect(out.status).toBe(0);
    for (const word of ['--out', '--repo', '--dry-run']) expect(out.stdout).toContain(word);
  });

  test('--dry-run says what it would do and writes nothing', () => {
    const zip = join(work, 'dry.zip');
    const out = run('--out', zip, '--dry-run');
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/would package 2 commits/);
    expect(spawnSync('test', ['-e', zip]).status).not.toBe(0);
  });

  test('refuses a repository with uncommitted changes', () => {
    writeFileSync(join(repo, 'dirty.txt'), 'x');
    const out = run('--out', join(work, 'dirty.zip'));
    expect(out.status).toBe(1);
    expect(out.stderr).toMatch(/uncommitted/);
    rmSync(join(repo, 'dirty.txt'));
  });

  test('packs the whole history, and leaves out ignored files such as .env and node_modules', () => {
    const zip = join(work, 'out.zip');
    const out = run('--out', zip);
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/2 commits/);
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n');
    expect(names.some((n) => n.includes('/.git/'))).toBe(true);
    expect(names.some((n) => n.endsWith('/README.md'))).toBe(true);
    expect(names.some((n) => n.endsWith('/.env'))).toBe(false);
    expect(names.some((n) => n.includes('node_modules'))).toBe(false);
  });
});

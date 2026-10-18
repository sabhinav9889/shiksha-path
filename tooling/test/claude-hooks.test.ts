import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const hook = (name: string): string => join(repoRoot, '.claude', 'hooks', name);

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd });
}

function tempRepo(opts: { commit: boolean; branch?: string; detach?: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), 'hookrepo-'));
  git(dir, 'init', '-q', '-b', 'main');
  if (opts.commit) git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  if (opts.branch) git(dir, 'checkout', '-q', '-b', opts.branch);
  if (opts.detach) git(dir, 'checkout', '-q', '--detach');
  return dir;
}

function runHook(name: string, cwd: string, filePath = 'src/a.ts', projectDir?: string): number {
  const env = { ...process.env };
  delete env['CLAUDE_PROJECT_DIR'];
  if (projectDir) env['CLAUDE_PROJECT_DIR'] = projectDir;
  const input = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: filePath } });
  return spawnSync('bash', [hook(name)], { cwd, env, input }).status ?? -1;
}

describe('block-main-edit', () => {
  test('blocks edit on main', () => {
    const dir = tempRepo({ commit: true });
    expect(runHook('block-main-edit.sh', dir, 'src/a.ts', dir)).toBe(2);
  });

  test('allows edit on feature branch', () => {
    const dir = tempRepo({ commit: true, branch: 'feature/x' });
    expect(runHook('block-main-edit.sh', dir, 'src/a.ts', dir)).toBe(0);
  });

  test('allows detached HEAD', () => {
    const dir = tempRepo({ commit: true, detach: true });
    expect(runHook('block-main-edit.sh', dir, 'src/a.ts', dir)).toBe(0);
  });

  test('allows repo with no commits', () => {
    const dir = tempRepo({ commit: false });
    expect(runHook('block-main-edit.sh', dir, 'src/a.ts', dir)).toBe(0);
  });

  test('works without CLAUDE_PROJECT_DIR', () => {
    const dir = tempRepo({ commit: true });
    const sub = join(dir, 'nested');
    mkdirSync(sub);
    expect(runHook('block-main-edit.sh', sub)).toBe(2);
  });
});

describe('block-secret-files', () => {
  const dir = tempRepo({ commit: true, branch: 'feature/x' });
  const check = (path: string): number => runHook('block-secret-files.sh', dir, path, dir);

  test('blocks writing .env', () => expect(check('/repo/.env')).toBe(2));
  test('blocks .env.production', () => expect(check('/repo/apps/web/.env.production')).toBe(2));
  test('allows .env.example', () => expect(check('/repo/.env.example')).toBe(0));
  test('blocks key.pem', () => expect(check('/repo/certs/key.pem')).toBe(2));
  test('blocks credentials.json', () => expect(check('/repo/credentials.json')).toBe(2));
  test('allows normal source', () => expect(check('/repo/src/env.ts')).toBe(0));
});

describe('Claude instructions', () => {
  const lineCount = (p: string): number => readFileSync(p, 'utf8').split('\n').length;

  test('CLAUDE.md is at most 120 lines', () => {
    expect(lineCount(join(repoRoot, 'CLAUDE.md'))).toBeLessThanOrEqual(120);
  });

  test('every rules file is at most 80 lines', () => {
    const dir = join(repoRoot, '.claude', 'rules');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const f of files) expect(lineCount(join(dir, f)), f).toBeLessThanOrEqual(80);
  });

  test('CLAUDE.md links resolve', () => {
    const text = readFileSync(join(repoRoot, 'CLAUDE.md'), 'utf8');
    const targets = [...text.matchAll(/\]\((?!https?:|#)([^)\s#]+)/g)].map((m) => m[1] ?? '');
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((t) => !existsSync(join(repoRoot, t)))).toEqual([]);
  });

  test('settings.json wires the hooks', () => {
    const settings = readFileSync(join(repoRoot, '.claude', 'settings.json'), 'utf8');
    for (const h of ['block-main-edit.sh', 'block-secret-files.sh', 'auto-format.sh']) {
      expect(settings).toContain(h);
    }
  });
});

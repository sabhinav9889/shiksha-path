import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const bin = (name: string): string => join(repoRoot, 'node_modules', '.bin', name);

function run(cmd: string, args: string[], input = ''): { code: number; out: string } {
  const r = spawnSync(cmd, args, { cwd: repoRoot, input, encoding: 'utf8' });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

const commitlint = (message: string): { code: number; out: string } =>
  run(bin('commitlint'), [], message);

function secretlint(fileName: string, text: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'secretlint-'));
  const file = join(dir, fileName);
  writeFileSync(file, text);
  const rc = join(repoRoot, '.secretlintrc.json');
  return run(bin('secretlint'), ['--secretlintrc', rc, '--maskSecrets', file]);
}

describe('commitlint', () => {
  test('rejects "updated stuff"', () => {
    const r = commitlint('updated stuff');
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('type-empty');
  });

  test('accepts "feat(content): add lesson schema"', () => {
    expect(commitlint('feat(content): add lesson schema').code).toBe(0);
  });

  test('accepts a body + Co-Authored-By trailer', () => {
    const msg =
      'fix(sync): retry failed batches\n\nWhy it matters.\n\n' +
      'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
    expect(commitlint(msg).code).toBe(0);
  });
});

describe('secretlint', () => {
  test('flags a fake AWS key', () => {
    // Built at runtime so no scanner (gitleaks, secretlint) sees a key-shaped literal in this file.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const pick = (n: number, step: number): string =>
      Array.from({ length: n }, (_, i) => alphabet[(i * step) % alphabet.length]).join('');
    const keyId = 'AKIA' + pick(16, 7).toUpperCase();
    const keyValue = pick(40, 11); // 40 chars, like real AWS secret keys
    const text = `aws_access_key_id = ${keyId}\naws_secret_access_key = ${keyValue}\n`;
    const r = secretlint('config.ini', text);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('secretlint-rule-aws');
  });

  test('flags a private key block', () => {
    const begin = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
    const end = '-----END ' + 'RSA PRIVATE KEY-----';
    const body = 'MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MaGBir/JXHFOqX6t\n'.repeat(5);
    const r = secretlint('id_rsa', `${begin}\n${body}${end}\n`);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('secretlint-rule-privatekey');
  });

  test('does not flag lesson text', () => {
    const hindi = 'नमस्ते, मेरा नाम प्रिया है। मैं support team में नई हूँ। '.repeat(20);
    const hash = 'a3f1c9e7b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6';
    expect(secretlint('lesson.md', `# पाठ\n\n${hindi}\n\naudio: audio/${hash}.mp3\n`).code).toBe(0);
  });
});

describe('pre-commit blocks commits on main', () => {
  const script = join(repoRoot, 'tooling', 'hooks', 'block-main-commit.sh');
  function repo(commit: boolean, branch?: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'commitrepo-'));
    const g = (...a: string[]): void => {
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir });
    };
    g('init', '-q', '-b', 'main');
    if (commit) g('commit', '-q', '--allow-empty', '-m', 'init');
    if (branch) g('checkout', '-q', '-b', branch);
    return dir;
  }
  const commitCheck = (dir: string): number =>
    spawnSync('bash', [script], { cwd: dir, encoding: 'utf8' }).status ?? -1;

  test('blocks a commit on main', () => expect(commitCheck(repo(true))).toBe(1));
  test('allows a commit on a feature branch', () =>
    expect(commitCheck(repo(true, 'feature/x'))).toBe(0));
  test('allows the first commit of a new repo', () => expect(commitCheck(repo(false))).toBe(0));
  test('pre-commit runs the main-commit guard', () => {
    expect(readFileSync(join(repoRoot, '.husky', 'pre-commit'), 'utf8')).toContain(
      'block-main-commit.sh',
    );
  });
});

describe('lint-staged command', () => {
  test('lets ESLint-ignored files (e.g. *.generated.ts) be committed', () => {
    const rc = JSON.parse(readFileSync(join(repoRoot, '.lintstagedrc.json'), 'utf8')) as Record<
      string,
      string[]
    >;
    const eslintCmd = (rc['*.{ts,js}'] ?? []).find((c) => c.startsWith('eslint')) ?? '';
    const args = eslintCmd
      .split(' ')
      .slice(1)
      .filter((a) => a !== '--fix');
    const r = spawnSync(
      bin('eslint'),
      [...args, '--stdin', '--stdin-filename', 'packages/a/src/schema.generated.ts'],
      { cwd: repoRoot, input: 'export const x = 1;\n', encoding: 'utf8' },
    );
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
  });
});

describe('block-main-push', () => {
  const script = join(repoRoot, 'tooling', 'hooks', 'block-main-push.sh');
  const line = (remoteRef: string): string =>
    `refs/heads/x ${'1'.repeat(40)} ${remoteRef} ${'0'.repeat(40)}\n`;

  test('blocks refs/heads/main', () => {
    const r = run('bash', [script], line('refs/heads/main'));
    expect(r.code).toBe(1);
    expect(r.out).toContain('Direct push to main is blocked');
  });

  test('allows refs/heads/feature/x', () => {
    expect(run('bash', [script], line('refs/heads/feature/x')).code).toBe(0);
  });
});

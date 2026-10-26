#!/usr/bin/env node
// Packs the project and its FULL git history into one ZIP for the hackathon submission.
// It clones the repository (so ignored files such as .env and node_modules are never included),
// scans the clone for secrets, zips it, then unzips it again and checks the result.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const USAGE = `Usage: node tooling/package-submission.mjs [--repo <dir>] [--out <file.zip>] [--ref <git ref>] [--dry-run]

  --repo <dir>   the repository to package (default: the current folder)
  --out <file>   the ZIP to write (default: ../shiksha-path-submission.zip)
  --ref <ref>    the commit or branch to package (default: HEAD)
  --dry-run      say what would be packaged and write nothing
  --help         show this help

Refuses a repository with uncommitted changes. Scans the clone with secretlint; run gitleaks too
(CI does) before submitting. Never prints file contents or secrets.`;

const { values } = parseArgs({
  options: {
    repo: { type: 'string', default: '.' },
    out: { type: 'string' },
    ref: { type: 'string', default: 'HEAD' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const repo = resolve(values.repo);
const out = resolve(values.out ?? join(repo, '..', 'shiksha-path-submission.zip'));
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (git(repo, 'status', '--porcelain') !== '') {
  fail('refusing: the repository has uncommitted changes. Commit or remove them first.');
}
const commits = Number(git(repo, 'rev-list', '--count', values.ref));
if (values['dry-run']) {
  console.log(`would package ${commits} commits of ${values.ref} into ${out}`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'shiksha-submission-'));
try {
  const clone = join(work, 'shiksha-path');
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', repo, clone]);
  git(
    clone,
    'checkout',
    '--quiet',
    values.ref === 'HEAD' ? git(repo, 'rev-parse', 'HEAD') : values.ref,
  );
  const scan = spawnSync('npx', ['secretlint', '--maskSecrets', `${clone}/**/*`], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  if (scan.status !== 0)
    fail(`refusing: secretlint reported a problem.\n${scan.stdout}${scan.stderr}`);
  rmSync(out, { force: true });
  execFileSync('zip', ['-r', '-q', out, 'shiksha-path'], { cwd: work });
  // Check the ZIP the way a judge would receive it.
  const check = join(work, 'check');
  execFileSync('unzip', ['-q', out, '-d', check]);
  const packed = Number(git(join(check, 'shiksha-path'), 'rev-list', '--count', 'HEAD'));
  if (packed !== commits) fail(`refusing: the ZIP has ${packed} commits, expected ${commits}`);
  const sha = createHash('sha256').update(readFileSync(out)).digest('hex');
  const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
  console.log(`wrote ${out}\n${commits} commits, ${mb} MB, sha256 ${sha}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

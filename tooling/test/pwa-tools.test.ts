import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const node = (script: string, args: string[]): { status: number | null; out: string } => {
  const run = spawnSync('node', [script, ...args], { encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
};

describe('tooling/make-icons.mjs', () => {
  test('--help explains itself', () => {
    const run = node('tooling/make-icons.mjs', ['--help']);
    expect(run.status).toBe(0);
    expect(run.out).toContain('--dry-run');
  });

  test('--dry-run lists the three icons and writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'icons-'));
    const run = node('tooling/make-icons.mjs', ['--dry-run', '--out', dir]);
    expect(run.status).toBe(0);
    for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
      expect(run.out).toContain(name);
    }
    expect(readdirSync(dir)).toEqual([]);
  });

  test('writes valid PNGs of the right sizes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'icons-'));
    execFileSync('node', ['tooling/make-icons.mjs', '--out', dir]);
    expect(readdirSync(dir).sort()).toEqual([
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
    ]);
  });
});

describe('tooling/check-bundle-size.mjs', () => {
  function dist(scriptBytes: number): string {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(dir, 'assets'));
    const body = randomBytes(scriptBytes); // random bytes: gzip cannot shrink them
    writeFileSync(join(dir, 'assets', 'index.js'), body);
    writeFileSync(join(dir, 'assets', 'late.js'), body); // not loaded on first visit
    writeFileSync(
      join(dir, 'index.html'),
      '<html><head><script type="module" src="/assets/index.js"></script></head></html>',
    );
    return dir;
  }

  test('passes a first-load script under the budget', () => {
    const run = node('tooling/check-bundle-size.mjs', [dist(20_000)]);
    expect(run.status).toBe(0);
    expect(run.out).toMatch(/KB gzipped/);
  });

  test('fails a first-load script over 120 KB gzipped', () => {
    const dir = dist(400_000);
    const run = node('tooling/check-bundle-size.mjs', [dir]);
    expect(run.status).toBe(1);
    expect(run.out).toContain('120');
  });

  test('fails when staff code (the /v1/staff/ API) is in the first load', () => {
    const dir = dist(1000);
    writeFileSync(join(dir, 'assets', 'index.js'), 'fetch("/v1/staff/me")');
    const run = node('tooling/check-bundle-size.mjs', [dir]);
    expect(run.status).toBe(1);
    expect(run.out).toContain('staff');
  });

  test('--help explains itself', () => {
    expect(node('tooling/check-bundle-size.mjs', ['--help']).out).toContain('Usage');
  });
});

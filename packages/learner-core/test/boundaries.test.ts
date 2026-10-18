import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const BROWSER_GLOBALS =
  /\b(window|document|navigator|indexedDB|localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(/;

describe('learner-core stays headless', () => {
  const files = sources(join(pkgDir, 'src')).map((path) => ({
    path,
    code: stripComments(readFileSync(path, 'utf8')),
  }));

  test('scans real source files', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  test('uses no browser global (everything goes through a port)', () => {
    const offenders = files.filter((f) => BROWSER_GLOBALS.test(f.code)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  test('never imports the Node-only @shiksha/content entry', () => {
    const offenders = files.filter((f) => /from\s+'@shiksha\/content'/.test(f.code));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  test('tsconfig keeps DOM types out', () => {
    const tsconfig = JSON.parse(readFileSync(join(pkgDir, 'tsconfig.json'), 'utf8')) as {
      compilerOptions: { lib: string[] };
    };
    expect(tsconfig.compilerOptions.lib).toEqual(['ES2023']);
  });
});

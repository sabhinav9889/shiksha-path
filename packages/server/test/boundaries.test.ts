import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the server keeps providers in adapters (spec §5.5)', () => {
  const files = sources(SRC).map((path) => ({
    path: relative(SRC, path),
    code: stripComments(readFileSync(path, 'utf8')),
  }));

  test('has source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('only adapters import Supabase or the Postgres driver', () => {
    const offenders = files
      .filter((f) => !f.path.startsWith('adapters/') && f.path !== 'edge-entry.ts')
      .filter((f) => /from\s+'(@supabase\/supabase-js|postgres)'/.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  test('never writes to the console (ids only, through a logger, if ever)', () => {
    expect(files.filter((f) => /\bconsole\./.test(f.code)).map((f) => f.path)).toEqual([]);
  });
});

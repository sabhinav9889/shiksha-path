import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('the API contract is browser-safe', () => {
  test('imports only zod and its own files', () => {
    const files = sources(SRC);
    expect(files.length).toBeGreaterThan(0);
    const external = new Set<string>();
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bfrom\s+'([^']+)'/g)) {
        const spec = match[1] ?? '';
        if (!spec.startsWith('.')) external.add(spec);
      }
    }
    expect([...external].filter((spec) => spec !== 'zod')).toEqual([]);
  });
});

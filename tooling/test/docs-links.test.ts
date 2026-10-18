import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const LINK = /\]\((?!https?:|mailto:|#)([^)\s]+)\)/g;

function markdownFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return path.endsWith('.md') ? [path] : [];
  return readdirSync(path).flatMap((name) => markdownFiles(join(path, name)));
}

function brokenLinks(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(LINK)]
    .map((m) => (m[1] ?? '').split('#')[0] ?? '')
    .filter((target) => target !== '' && !existsSync(join(dirname(file), target)))
    .map((target) => `${relative(repoRoot, file)} → ${target}`);
}

const roots = ['docs', 'CLAUDE.md', 'WORKLOG.md', '.claude'].map((p) => join(repoRoot, p));

describe('documentation links', () => {
  test('the docs that Plan 0 creates exist', () => {
    for (const p of [
      'docs/engineering-standards.md',
      'docs/decisions/README.md',
      'docs/gotchas/README.md',
      'docs/self-correction.md',
      'WORKLOG.md',
      '.claude/worklog/README.md',
    ]) {
      expect(existsSync(join(repoRoot, p)), p).toBe(true);
    }
  });

  test('every relative Markdown link resolves to an existing file', () => {
    const broken = roots.flatMap(markdownFiles).flatMap(brokenLinks);
    expect(broken).toEqual([]);
  });
});

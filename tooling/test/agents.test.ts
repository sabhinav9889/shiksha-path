import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const agentsDir = fileURLToPath(new URL('../../.claude/agents/', import.meta.url));
const AGENTS = ['spec-reviewer', 'code-reviewer', 'security-reviewer', 'architect'] as const;
const READ_ONLY = new Set(['Read', 'Grep', 'Glob']);

interface Agent {
  meta: { name?: string; description?: string; model?: string; tools?: string[] };
  body: string;
}

function load(name: string): Agent {
  const text = readFileSync(join(agentsDir, `${name}.md`), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${name}: missing front-matter`);
  return { meta: parse(match[1] ?? '') as Agent['meta'], body: match[2] ?? '' };
}

describe('agents', () => {
  test.each(AGENTS)('%s is read-only', (name) => {
    const tools = load(name).meta.tools ?? [];
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.filter((t) => !READ_ONLY.has(t))).toEqual([]);
  });

  test.each(AGENTS)('%s has name, description, model', (name) => {
    const { meta } = load(name);
    expect(meta.name).toBe(name);
    expect(meta.description?.length ?? 0).toBeGreaterThan(20);
    expect(meta.model).toBeTruthy();
  });

  test.each(['spec-reviewer', 'code-reviewer', 'security-reviewer'])(
    '%s defines PASS/FAIL output',
    (name) => {
      const { body } = load(name);
      expect(body).toContain('PASS');
      expect(body).toContain('FAIL');
      expect(body).toMatch(/never edit/i);
      expect(body).toMatch(/diff file/i); // reviewers have no shell: the caller hands over the diff
    },
  );

  test('security-reviewer checklist covers prompt injection, RLS, secrets, minors', () => {
    const body = load('security-reviewer').body.toLowerCase();
    for (const topic of ['prompt injection', 'row-level security', 'secret', 'minor']) {
      expect(body, topic).toContain(topic);
    }
  });
});

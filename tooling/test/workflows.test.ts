import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const githubDir = fileURLToPath(new URL('../../.github/', import.meta.url));
const workflowsDir = join(githubDir, 'workflows');
const workflows = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));

interface Job {
  permissions?: Record<string, string>;
  steps?: { uses?: string }[];
}
const jobsOf = (file: string): Record<string, Job> =>
  (parse(readFileSync(join(workflowsDir, file), 'utf8')) as { jobs: Record<string, Job> }).jobs;

describe('GitHub workflows', () => {
  test.each(workflows)('%s pins every action to a full commit SHA', (file) => {
    const uses = Object.values(jobsOf(file)).flatMap((j) => (j.steps ?? []).map((s) => s.uses));
    const refs = uses.filter((u): u is string => typeof u === 'string');
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter((u) => !/@[0-9a-f]{40}$/.test(u))).toEqual([]);
  });

  test('gitleaks job can list pull request commits', () => {
    expect(jobsOf('security.yml')['gitleaks']?.permissions?.['pull-requests']).toBe('read');
  });
});

describe('Dependabot', () => {
  test('every ecosystem waits at least 7 days for new versions', () => {
    const config = parse(readFileSync(join(githubDir, 'dependabot.yml'), 'utf8')) as {
      updates: { cooldown?: { 'default-days'?: number } }[];
    };
    for (const u of config.updates)
      expect(u.cooldown?.['default-days'] ?? 0).toBeGreaterThanOrEqual(7);
  });
});

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

describe('the nightly backup', () => {
  const workflow = parse(readFileSync(join(workflowsDir, 'backup.yml'), 'utf8')) as {
    on: { schedule: { cron: string }[]; workflow_dispatch: unknown };
    permissions: Record<string, string>;
    jobs: Record<string, { container?: string; needs?: string; steps: { run?: string }[] }>;
  };

  test('runs at 02:00 IST every night, and by hand', () => {
    expect(workflow.on.schedule).toEqual([{ cron: '30 20 * * *' }]);
    expect('workflow_dispatch' in workflow.on).toBe(true);
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  test('backs up in the image the restore check uses, pinned by digest', () => {
    const check = readFileSync(join(githubDir, '../tooling/backup/restore-check.sh'), 'utf8');
    const image = workflow.jobs.backup?.container ?? '';
    expect(image).toMatch(/^debian:trixie@sha256:[0-9a-f]{64}$/);
    expect(check).toContain(image);
  });

  test('deletes old recordings only after a backup succeeded', () => {
    expect(workflow.jobs.retention?.needs).toBe('backup');
    const runs = workflow.jobs.retention?.steps.map((s) => s.run ?? '').join('\n') ?? '';
    expect(runs).toContain('npm run admin -- retention');
  });
});

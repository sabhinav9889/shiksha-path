import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { localStack } from '../../supabase/tests/stack.js';
import { makeAdminDeps, runAdmin, type AdminIo } from '../admin/commands.js';

const { apiUrl, serviceKey } = localStack();
const env = {
  SUPABASE_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: apiUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  CODE_PEPPER: 'admin-test-pepper-0123456789abcdef0',
};
const admin = makeAdminDeps(env);
let lines: string[];
const io: AdminIo = { out: (line) => lines.push(line), err: (line) => lines.push(`! ${line}`) };
const run = (...argv: string[]): Promise<number> => runAdmin(argv, admin, io);

beforeEach(() => {
  lines = [];
});

afterAll(async () => {
  await admin.close();
});

describe('the admin tool', () => {
  test('--help lists every command and exits 0', async () => {
    expect(await run('--help')).toBe(0);
    const help = lines.join('\n');
    for (const command of ['issue-code', 'reset-code', 'export', 'delete', 'retention']) {
      expect(help).toContain(command);
    }
  });

  test('an unknown command or missing option exits 1 and changes nothing', async () => {
    expect(await run('nope')).toBe(1);
    expect(await run('reset-code')).toBe(1);
  });

  test('issue-code prints the learner id and the code, never anything else personal', async () => {
    expect(await run('issue-code', '--name', 'प्रिया शर्मा')).toBe(0);
    const out = lines.join('\n');
    expect(out).toMatch(/learner [0-9a-f-]{36}/);
    expect(out).toMatch(/code [A-Z2-9]{4}-[A-Z2-9]{4}/);
    expect(out).not.toContain('प्रिया');
    const learnerId = /learner ([0-9a-f-]{36})/.exec(out)?.[1] ?? '';
    expect(await run('delete', '--learner', learnerId, '--yes')).toBe(0);
  });

  test('export writes learner.json and the recordings into the folder', async () => {
    await run('issue-code', '--name', 'A');
    const learnerId = /learner ([0-9a-f-]{36})/.exec(lines.join('\n'))?.[1] ?? '';
    const dir = mkdtempSync(join(tmpdir(), 'shiksha-export-'));
    try {
      expect(await run('export', '--learner', learnerId, '--out', dir)).toBe(0);
      const data = JSON.parse(readFileSync(join(dir, 'learner.json'), 'utf8')) as {
        learner: { id: string };
      };
      expect(data.learner.id).toBe(learnerId);
      expect(readdirSync(dir)).toContain('recordings');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await run('delete', '--learner', learnerId, '--yes');
    }
  });

  test('delete without --yes changes nothing; --dry-run prints the counts only', async () => {
    await run('issue-code', '--name', 'A');
    const learnerId = /learner ([0-9a-f-]{36})/.exec(lines.join('\n'))?.[1] ?? '';
    lines = [];
    expect(await run('delete', '--learner', learnerId)).toBe(1);
    expect(await run('delete', '--learner', learnerId, '--dry-run')).toBe(0);
    expect(lines.join('\n')).toMatch(/would delete: 0 events, 0 recordings, 1 sign-in/);
    expect(await run('export', '--learner', learnerId, '--out', tmpdir(), '--dry-run')).toBe(0);
    expect(await run('reset-code', '--learner', learnerId, '--dry-run')).toBe(0);
    expect(await run('delete', '--learner', learnerId, '--yes')).toBe(0);
    expect(lines.join('\n')).toMatch(/deleted: 0 events, 0 recordings, 1 sign-in/);
  });

  test('retention says what it would delete, then deletes it', async () => {
    expect(await run('retention', '--dry-run')).toBe(0);
    expect(lines.join('\n')).toMatch(/would delete \d+ recordings?/);
    expect(await run('retention')).toBe(0);
    expect(lines.join('\n')).toMatch(/deleted \d+ recordings?, \d+ rate-limit windows?/);
  });

  test('the environment is checked, and secrets are never printed', async () => {
    expect(() => makeAdminDeps({ ...env, CODE_PEPPER: 'short' })).toThrow(/CODE_PEPPER/);
    await run('--help');
    expect(lines.join('\n')).not.toContain(serviceKey);
    expect(lines.join('\n')).not.toContain(env.CODE_PEPPER);
  });
});

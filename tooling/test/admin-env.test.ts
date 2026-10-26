import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { makeAdminDeps } from '../admin/commands.js';

const CLI = fileURLToPath(new URL('../admin/cli.ts', import.meta.url));
const NEEDED = ['SUPABASE_DB_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

describe('the admin tool without its settings', () => {
  test('the error names every missing setting', () => {
    let message = '';
    try {
      makeAdminDeps({});
    } catch (error) {
      message = (error as Error).message;
    }
    for (const name of NEEDED) expect(message).toContain(name);
    expect(message).not.toMatch(/expected string/);
  });

  test('on the command line it says what to set and exits 1, with no stack trace', () => {
    const out = spawnSync('npx', ['tsx', CLI, 'seed-demo'], {
      env: { PATH: process.env.PATH ?? '' },
      encoding: 'utf8',
    });
    expect(out.status).toBe(1);
    for (const name of NEEDED) expect(out.stderr).toContain(name);
    expect(out.stderr).not.toMatch(/\n\s+at /);
  });
});

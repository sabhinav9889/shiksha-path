import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { afterEach, describe, expect, test } from 'vitest';

const APP = join(process.cwd(), 'apps/learner');
const ENV_FILE = join(APP, '.env.csptest');

afterEach(() => {
  rmSync(ENV_FILE, { force: true });
});

describe('the build configuration', () => {
  test('the security policy allows the lesson-pack host set in a Vite .env file', async () => {
    writeFileSync(ENV_FILE, 'VITE_CONTENT_BASE_URL=https://packs.example.org/v1\n');
    const config = (await import('../vite.config.js')).default as (env: {
      mode: string;
      command: 'build';
    }) => UserConfig;
    const plugins = (
      config({ mode: 'csptest', command: 'build' }).plugins ?? []
    ).flat() as Plugin[];
    const csp = plugins.find((plugin) => plugin?.name === 'shiksha-csp');
    const transform = csp?.transformIndexHtml as (html: string) => string;
    expect(transform('<head></head>')).toContain("connect-src 'self' https://packs.example.org");
  });

  test('the policy also allows the Supabase host set in a .env file', async () => {
    writeFileSync(ENV_FILE, 'VITE_SUPABASE_URL=https://abc.supabase.co\n');
    const config = (await import('../vite.config.js')).default as (env: {
      mode: string;
      command: 'build';
    }) => UserConfig;
    const plugins = (
      config({ mode: 'csptest', command: 'build' }).plugins ?? []
    ).flat() as Plugin[];
    const csp = plugins.find((plugin) => plugin?.name === 'shiksha-csp');
    const transform = csp?.transformIndexHtml as (html: string) => string;
    expect(transform('<head></head>')).toContain("connect-src 'self' https://abc.supabase.co");
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { connect } from './db.js';

const sql = connect();
const ROOT = join(process.cwd(), 'supabase');
const UP = readFileSync(join(ROOT, 'migrations/20261020000001_learners_and_events.sql'), 'utf8');
const DOWN = readFileSync(
  join(ROOT, 'rollbacks/20261020000001_learners_and_events.down.sql'),
  'utf8',
);
const SEED = readFileSync(join(ROOT, 'seed.sql'), 'utf8');

afterAll(async () => {
  await sql.end();
});

describe('the schema', () => {
  test('every table in public has row-level security on', async () => {
    const tables = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`;
    expect(tables.length).toBeGreaterThanOrEqual(6);
    expect(tables.filter((t) => !t.relrowsecurity).map((t) => t.relname)).toEqual([]);
  });

  test('every table has created_at and updated_at', async () => {
    const missing = await sql`
      select t.table_name from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
        and (select count(*) from information_schema.columns c
             where c.table_schema = 'public' and c.table_name = t.table_name
               and c.column_name in ('created_at', 'updated_at')) < 2`;
    expect(missing.map((r) => r.table_name)).toEqual([]);
  });

  test('the up migration can run twice, and down then up works', async () => {
    // Static files from the repo, not user input.
    await sql.unsafe(UP);
    await sql.unsafe(DOWN);
    const left =
      await sql`select table_name from information_schema.tables where table_schema = 'public'`;
    expect(left.map((r) => r.table_name)).toEqual([]);
    await sql.unsafe(UP);
    await sql.unsafe(SEED);
    const switches = await sql`select count(*)::int as n from feature_switches`;
    expect(switches[0]?.n).toBe(6);
  });
});

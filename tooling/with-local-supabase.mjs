#!/usr/bin/env node
// Runs a command with the local Supabase stack's public address and anon key set as
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, read from `supabase status` (never from a file).
import { execFileSync, spawnSync } from 'node:child_process';

const USAGE = `Usage: node tooling/with-local-supabase.mjs [--help] [--dry-run] <command> [args...]

Reads the running local stack with \`npx supabase status -o env\` and runs <command> with
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set. --dry-run prints the command and which
variables would be set (never their values).`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  console.log(USAGE);
  process.exit(args.length === 0 ? 1 : 0);
}
const dryRun = args[0] === '--dry-run';
const command = dryRun ? args.slice(1) : args;

const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
const status = Object.fromEntries(
  [...out.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]),
);
if (!status.API_URL || !status.ANON_KEY) {
  console.error('the local Supabase stack is not running: npm run db:start');
  process.exit(1);
}
const env = {
  ...process.env,
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
};
if (dryRun) {
  console.log(`would run: ${command.join(' ')} (with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`);
  process.exit(0);
}
const result = spawnSync(command[0], command.slice(1), { env, stdio: 'inherit' });
process.exit(result.status ?? 1);

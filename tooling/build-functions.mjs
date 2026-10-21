#!/usr/bin/env node
// Bundles the server code for the Supabase Edge Function (Deno). Our packages import `.ts` files
// through `.js` specifiers, which Node and Vite resolve and Deno does not, so we bundle instead.
import { copyFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const USAGE = `Usage: node tooling/build-functions.mjs [--help]

Writes supabase/functions/api/server.bundle.js from packages/server/src/edge-entry.ts.
postgres and @supabase/supabase-js stay external (Deno loads them as npm: packages).
Also creates supabase/functions/.env.local from the example when it is missing.`;

if (process.argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

await build({
  entryPoints: ['packages/server/src/edge-entry.ts'],
  outfile: 'supabase/functions/api/server.bundle.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  external: ['postgres', '@supabase/supabase-js'],
  logLevel: 'warning',
});

const ENV = 'supabase/functions/.env.local';
if (!existsSync(ENV)) copyFileSync(`${ENV}.example`, ENV);
console.log('built supabase/functions/api/server.bundle.js');

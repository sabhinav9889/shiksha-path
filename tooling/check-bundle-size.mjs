#!/usr/bin/env node
// Fails when the JavaScript a first visit needs is over the size budget (gzipped).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 120;
const BYTES_PER_KB = 1024;
const USAGE = `Usage: node tooling/check-bundle-size.mjs [dist-folder]

Adds up the gzipped size of the scripts index.html loads on a first visit (the entry script and
its modulepreload links) and fails above ${BUDGET_KB} KB. The folder defaults to ./dist.`;

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
const dist = args[0] ?? 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [
  ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((match) => match[1].replace(/^\//, ''));

let total = 0;
for (const script of new Set(scripts)) {
  total += gzipSync(readFileSync(join(dist, script)), { level: 9 }).length;
}
const kb = total / BYTES_PER_KB;
console.log(`First-load JavaScript: ${kb.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB)`);
if (kb > BUDGET_KB) {
  console.error(`Over the ${BUDGET_KB} KB budget: split screens with dynamic imports.`);
  process.exit(1);
}

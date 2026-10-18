#!/usr/bin/env node
// Writes the placeholder app icons (solid indigo squares) as PNG files, with no dependencies.
// Real branding arrives with the admin panel (Plan 4).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const USAGE = `Usage: node tooling/make-icons.mjs [--out <dir>] [--dry-run] [--help]

Writes icon-192.png, icon-512.png and icon-maskable-512.png (solid #2F3AB2 squares).

  --out <dir>  where to write (default: apps/learner/public/icons)
  --dry-run    list what would be written, write nothing
  --help       show this text`;

const ICONS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
];
const COLOUR = [0x2f, 0x3a, 0xb2, 0xff];
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function solidPng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
  const row = Buffer.alloc(1 + size * 4); // filter byte 0, then pixels
  for (let x = 0; x < size; x += 1) row.set(COLOUR, 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : 'apps/learner/public/icons';
if (!outDir) {
  console.error('--out needs a folder');
  process.exit(2);
}
const dryRun = args.includes('--dry-run');
if (!dryRun) mkdirSync(outDir, { recursive: true });
for (const [name, size] of ICONS) {
  console.log(`${dryRun ? 'would write' : 'writing'} ${join(outDir, name)} (${size}x${size})`);
  if (!dryRun) writeFileSync(join(outDir, name), solidPng(size));
}

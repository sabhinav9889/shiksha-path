import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { pwaOptions } from './pwa.config.js';

const PUBLIC_DIR = join(process.cwd(), 'apps/learner/public');
const PNG_SIGNATURE = '89504e470d0a1a0a';

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): { signature: string; width: number; height: number } {
  const bytes = readFileSync(path);
  return {
    signature: bytes.subarray(0, 8).toString('hex'),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('the web app manifest', () => {
  const manifest = pwaOptions.manifest as Exclude<typeof pwaOptions.manifest, false | undefined>;

  test('names the app in Hindi and opens it like an installed app', () => {
    expect(manifest).toMatchObject({
      name: 'शिक्षा पथ',
      short_name: 'शिक्षा पथ',
      lang: 'hi',
      display: 'standalone',
      start_url: '/',
      theme_color: '#2F3AB2',
      background_color: '#F4F5FA',
    });
  });

  test('lists a 192, a 512 and a maskable 512 icon, and the files are valid PNGs of that size', () => {
    const icons = manifest.icons ?? [];
    expect(icons.map((i) => [i.sizes, i.purpose ?? 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    for (const icon of icons) {
      const [side] = (icon.sizes ?? '').split('x').map(Number);
      const size = pngSize(join(PUBLIC_DIR, icon.src));
      expect(size).toEqual({ signature: PNG_SIGNATURE, width: side, height: side });
    }
  });
});

describe('the service worker', () => {
  const workbox = pwaOptions.workbox ?? {};

  test('updates itself in the background', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
  });

  test('serves the app shell for page loads but never answers lesson-pack requests', () => {
    const deny = workbox.navigateFallbackDenylist ?? [];
    const denied = (path: string): boolean => deny.some((pattern) => pattern.test(path));
    expect(workbox.navigateFallback).toBe('index.html');
    expect(denied('/content/manifest.json')).toBe(true);
    expect(denied('/content/audio/0123456789abcdef.mp3')).toBe(true);
    expect(denied('/')).toBe(false);
    expect(denied('/index.html')).toBe(false);
  });

  test('has no runtime cache that matches lesson packs', () => {
    const routes = workbox.runtimeCaching ?? [];
    const matches = routes.filter((route) => {
      const pattern = route.urlPattern;
      return pattern instanceof RegExp && pattern.test('https://app.example/content/manifest.json');
    });
    expect(matches).toEqual([]);
  });

  test('precaches the shell: scripts, styles, pages, fonts and icons', () => {
    expect(workbox.globPatterns).toEqual(['**/*.{js,css,html,woff2,svg,png}']);
  });
});

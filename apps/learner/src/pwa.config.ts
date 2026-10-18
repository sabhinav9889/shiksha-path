import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * The service worker caches only the app shell. Lesson packs are fetched and verified by the
 * app itself and kept in IndexedDB, so `/content/` must never be answered or cached here.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: false,
  includeAssets: ['icons/*.png'],
  manifest: {
    name: 'शिक्षा पथ',
    short_name: 'शिक्षा पथ',
    lang: 'hi',
    display: 'standalone',
    start_url: '/',
    theme_color: '#2F3AB2',
    background_color: '#F4F5FA',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/content\//],
    globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
    runtimeCaching: [],
  },
};

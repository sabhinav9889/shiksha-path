import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspPlugin } from './src/csp.js';
import { pwaOptions } from './src/pwa.config.js';

const contentBaseUrl = process.env.VITE_CONTENT_BASE_URL ?? '/content';

export default defineConfig({
  plugins: [svelte(), VitePWA(pwaOptions), cspPlugin(contentBaseUrl)],
});

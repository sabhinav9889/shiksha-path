import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspPlugin } from './src/csp.js';
import { pwaOptions } from './src/pwa.config.js';

const APP_DIR = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // The same source the app reads (import.meta.env): .env files and VITE_ variables.
  const env = loadEnv(mode, APP_DIR, 'VITE_');
  const contentBaseUrl = env.VITE_CONTENT_BASE_URL ?? '/content';
  // Google sign-in and the /v1 API live on the Supabase host.
  const apiUrls = env.VITE_SUPABASE_URL ? [env.VITE_SUPABASE_URL] : [];
  return { plugins: [svelte(), VitePWA(pwaOptions), cspPlugin(contentBaseUrl, apiUrls)] };
});

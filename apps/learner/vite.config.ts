import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './src/pwa.config.js';

export default defineConfig({ plugins: [svelte(), VitePWA(pwaOptions)] });

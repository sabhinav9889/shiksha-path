import '@fontsource/baloo-2/devanagari-600.css';
import '@fontsource/baloo-2/devanagari-700.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/mukta/devanagari-400.css';
import '@fontsource/mukta/devanagari-500.css';
import '@fontsource/mukta/devanagari-600.css';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/latin-500.css';
import '@fontsource/mukta/latin-600.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { appState, initApp } from './app-state.svelte.js';
import { startAutoSync } from './runtime/auto-sync.js';
import { createRuntime } from './runtime/runtime.js';
import './styles/tokens.css';

const runtime = createRuntime();
initApp(runtime);
startAutoSync({
  content: runtime.content,
  flush: async () => {
    if (appState.profile) await runtime.flush(appState.profile.id);
  },
  target: window,
});

const target = document.getElementById('app');
if (target) mount(App, { target });

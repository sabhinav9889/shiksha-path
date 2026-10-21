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
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { appState, initApp, refreshSession, reloadSwitches } from './app-state.svelte.js';
import { startAutoSync } from './runtime/auto-sync.js';
import { captureInstallPrompt, install } from './runtime/install-prompt.js';
import { createRuntime } from './runtime/runtime.js';
import './styles/tokens.css';

// New versions install in the background and apply the next time the app opens.
registerSW({ immediate: true });

install.prompt = captureInstallPrompt(window); // before the browser fires the offer

const runtime = createRuntime();
initApp(runtime);
startAutoSync({
  content: runtime.content,
  flush: async () => {
    if (!appState.profile) return;
    const { added } = await runtime.sync(appState.profile.id);
    if (added > 0) await refreshSession({ force: true });
    await reloadSwitches();
  },
  target: window,
});

const target = document.getElementById('app');
if (target) mount(App, { target });

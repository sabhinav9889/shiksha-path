<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from '../../app-state.svelte.js';
  import { t, type Lang } from '../../i18n/index.js';
  import { uploadRecordings } from '../../runtime/recording-upload.js';

  /** Recordings waiting on this phone, and a button to send them now (the lab case, Plan 3b). */
  let { lang }: { lang: Lang } = $props();

  let waiting = $state(0);
  let busy = $state(false);
  let message = $state('');

  async function count(): Promise<void> {
    const { runtime, profile } = appState;
    if (!runtime || !profile) return;
    waiting = (await runtime.recordings.pendingUpload(profile.id)).length;
  }

  onMount(() => void count());

  async function upload(): Promise<void> {
    const { runtime, profile } = appState;
    if (!runtime || !profile || busy) return;
    busy = true;
    message = '';
    try {
      const { left } = await uploadRecordings(runtime, profile.id);
      message = left === 0 ? t('me.recordingsDone', lang) : t('status.savedLater', lang);
    } finally {
      await count();
      busy = false;
    }
  }
</script>

{#if waiting > 0 || message}
  <section class="card">
    {#if waiting > 0}
      <p>{t('me.recordingsWaiting', lang, { count: waiting })}</p>
      <button type="button" disabled={busy} onclick={upload}>{t('me.recordingsUpload', lang)}</button>
    {/if}
    {#if message}
      <p class="result" role="status">{message}</p>
    {/if}
  </section>
{/if}

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  p {
    margin: 0;
  }

  .result {
    font-weight: 600;
  }

  button {
    min-height: 48px;
    border: 1.5px solid var(--color-primary);
    border-radius: 14px;
    background: var(--color-card);
    color: var(--color-primary);
    font-size: 16px;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { BundleStorage } from '@shiksha/learner-core';
  import { audioObjectUrl } from '../../audio/audio-source.js';
  import { appState } from '../../app-state.svelte.js';
  import { t } from '../../i18n/index.js';
  import Icon from '../../ui/Icon.svelte';

  const ICON_SIZE = 24;

  interface Props {
    storage: BundleStorage;
    path: string | undefined;
    label: string;
    onmissing?: (() => Promise<void> | void) | undefined;
  }

  let { storage, path, label, onmissing }: Props = $props();

  let available = $state<boolean | null>(null);
  let src = $state<string | null>(null);
  let audio = $state<HTMLAudioElement>();
  let release: (() => void) | null = null;
  let loading = false;
  let destroyed = false;
  let failed = $state(false);

  $effect(() => {
    const wanted = path;
    available = null;
    if (wanted) {
      void storage.hasAudio(wanted).then((present) => {
        if (path === wanted) available = present;
      });
    }
  });

  function free(): void {
    release?.();
    release = null;
    src = null;
  }

  async function play(): Promise<void> {
    if (!path || loading) return; // a second tap while loading would orphan a URL
    free();
    loading = true;
    let source: Awaited<ReturnType<typeof audioObjectUrl>>;
    try {
      source = await audioObjectUrl(storage, path);
    } finally {
      loading = false;
    }
    if (destroyed) {
      source?.revoke(); // the learner left while it loaded
      return;
    }
    if (!source) {
      available = false;
      return;
    }
    release = source.revoke;
    src = source.url;
    await tick();
    await audio?.play();
  }

  async function fetchMissing(): Promise<void> {
    if (loading) return;
    loading = true;
    failed = false;
    try {
      await onmissing?.();
      available = path ? await storage.hasAudio(path) : false;
      failed = available === false;
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    destroyed = true;
    free();
  });
</script>

{#if path && available === true}
  <button type="button" class="play" aria-label={label} onclick={play}>
    <Icon name="speaker" size={ICON_SIZE} />
  </button>
  {#if src}
    <audio bind:this={audio} {src} onended={free} preload="none"></audio>
  {/if}
{:else if path && available === false}
  <button type="button" class="link" onclick={fetchMissing}>
    {t('lessons.audio', appState.lang)}
  </button>
  {#if failed}
    <p class="failed" role="alert">{t('lessons.audioFailed', appState.lang)}</p>
  {/if}
{/if}

<style>
  .play {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border: none;
    border-radius: var(--radius-m);
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }

  .link {
    border: none;
    background: none;
    color: var(--color-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .failed {
    margin: 0;
    color: var(--color-wrong);
    font-size: 14px;
  }
</style>

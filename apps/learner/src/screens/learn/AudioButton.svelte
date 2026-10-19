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
    if (!path) return;
    free();
    const source = await audioObjectUrl(storage, path);
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
    await onmissing?.();
    available = path ? await storage.hasAudio(path) : false;
  }

  onDestroy(free);
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
</style>

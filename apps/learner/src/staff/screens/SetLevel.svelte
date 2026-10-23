<script lang="ts">
  import type { Manifest } from '@shiksha/content/schema';
  import { onMount } from 'svelte';
  import { appState } from '../../app-state.svelte.js';
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';

  /** Move a student's start point, choosing from the lesson packs on this device. */
  let { learnerId, lang }: { learnerId: string; lang: Lang } = $props();
  let manifest = $state<Manifest | null>(null);
  let track = $state('');
  let lesson = $state('');
  let confirming = $state(false);
  let saved = $state(false);
  let failed = $state(false);

  const tracks = $derived([...(manifest?.tracks ?? [])].sort((a, b) => a.order - b.order));
  const lessons = $derived(
    (manifest?.modules ?? [])
      .filter((m) => m.track === track)
      .sort((a, b) => a.order - b.order)
      .flatMap((m) => [...m.lessons].sort((a, b) => a.order - b.order)),
  );

  function pickTrack(id: string): void {
    track = id;
    lesson = lessons[0]?.id ?? '';
  }

  async function loadManifest(): Promise<void> {
    manifest = (await appState.runtime?.storage.getManifest()) ?? null;
    if (!tracks.some((t) => t.id === track)) pickTrack(tracks[0]?.id ?? '');
  }

  // The lesson packs may still be arriving when the page opens: read them again when they do.
  onMount(() => {
    void loadManifest();
    return appState.runtime?.content.subscribe(() => void loadManifest());
  });

  async function save(): Promise<void> {
    failed = false;
    const result = await staffState.auth?.api.setLevel({ learnerId, track, startLesson: lesson });
    if (!result?.ok) {
      failed = true;
      return;
    }
    confirming = false;
    saved = true;
  }
</script>

<h3>{st('level', lang)}</h3>
{#if tracks.length === 0}
  <p>{st('noLessons', lang)}</p>
{:else}
  <label>
    {st('track', lang)}
    <select value={track} onchange={(e) => pickTrack(e.currentTarget.value)}>
      {#each tracks as t (t.id)}<option value={t.id}>{t.title[lang]}</option>{/each}
    </select>
  </label>
  <label>
    {st('startFrom', lang)}
    <select bind:value={lesson} onchange={() => (saved = false)}>
      {#each lessons as l (l.id)}<option value={l.id}>{l.id} · {l.title[lang]}</option>{/each}
    </select>
  </label>
  {#if confirming}
    <p>{st('confirmLevel', lang, { track, lesson })}</p>
    <button type="button" onclick={save}>{st('yesChange', lang)}</button>
    <button type="button" class="quiet" onclick={() => (confirming = false)}>
      {st('cancel', lang)}
    </button>
  {:else}
    <button type="button" onclick={() => ((confirming = true), (saved = false))}>
      {st('setLevel', lang)}
    </button>
  {/if}
  {#if saved}<p>{st('saved', lang)}</p>{/if}
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
{/if}

<style>
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  select {
    min-height: 44px;
  }

  button {
    min-height: 44px;
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }

  .quiet {
    background: var(--color-line);
    color: var(--color-ink);
  }
</style>

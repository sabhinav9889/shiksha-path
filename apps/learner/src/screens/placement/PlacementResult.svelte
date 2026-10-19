<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Manifest } from '@shiksha/content/schema';
  import { activity, resetActivity } from '../../activity.svelte.js';
  import { appState, setLanguagePreference } from '../../app-state.svelte.js';
  import { t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';

  const PERCENT = 100;

  let manifest = $state<Manifest | null>(null);
  /** Only a first placement can suggest English only; the session knows if it still stands. */
  let suggesting = $state(
    (activity.placementResult?.englishOnlySuggested ?? false) &&
      (appState.session?.progress.suggestEnglishOnly ?? false),
  );

  const result = $derived(activity.placementResult);
  const lang = $derived(appState.lang);

  $effect(() => {
    if (!result) navigate({ name: 'home' }); // nothing to show (a reload)
  });

  onMount(async () => {
    manifest = (await appState.runtime?.storage.getManifest()) ?? null;
  });

  onDestroy(resetActivity);

  const trackTitle = (id: string): string =>
    manifest?.tracks.find((tr) => tr.id === id)?.title[lang] ?? id;

  function lessonTitle(id: string): string {
    const lessons = manifest?.modules.flatMap((m) => m.lessons) ?? [];
    return lessons.find((l) => l.id === id)?.title[lang] ?? id;
  }

  async function accept(): Promise<void> {
    suggesting = false;
    await setLanguagePreference('en_only');
  }

  function start(): void {
    resetActivity();
    navigate({ name: 'home' });
  }
</script>

{#if result}
  <section class="result">
    <h1>{t('placementResult.title', lang)}</h1>
    {#each result.sections as section (section.track)}
      <div class="card">
        <strong>
          {t('placementResult.score', lang, {
            track: trackTitle(section.track),
            percent: Math.round(section.score * PERCENT),
          })}
        </strong>
        <span>{t('placementResult.start', lang, { lesson: lessonTitle(section.startLesson) })}</span>
      </div>
    {/each}

    {#if suggesting}
      <div class="card suggest">
        <p>{t('placementResult.suggest', lang)}</p>
        <button type="button" class="primary" onclick={accept}>
          {t('placementResult.yes', lang)}
        </button>
        <button type="button" onclick={() => (suggesting = false)}>
          {t('placementResult.no', lang)}
        </button>
      </div>
    {/if}

    <button type="button" class="primary go" onclick={start}>{t('action.start', lang)}</button>
  </section>
{/if}

<style>
  .result {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    min-height: 100dvh;
    padding: 28px 20px 22px;
    background: var(--color-card);
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 28px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-bg);
    overflow-wrap: anywhere;
  }

  .card span {
    color: var(--color-muted);
  }

  .suggest {
    gap: 10px;
    border: 2px solid var(--color-primary);
    background: var(--color-primary-soft);
  }

  .suggest p {
    margin: 0;
    font-weight: 600;
  }

  button {
    min-height: 48px;
    border: 1.5px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-card);
    font-size: 16px;
    font-weight: 600;
  }

  .primary {
    border: none;
    background: var(--color-primary);
    color: #fff;
  }

  .go {
    min-height: 52px;
    margin-top: auto;
  }
</style>

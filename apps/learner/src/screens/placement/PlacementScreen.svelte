<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import type { Localized, PracticeItem } from '@shiksha/content/schema';
  import type { Answer, QuizRun } from '@shiksha/learner-core';
  import { activity } from '../../activity.svelte.js';
  import { appState } from '../../app-state.svelte.js';
  import { t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import { ITEM_VIEWS } from '../practice/items/registry.js';
  import type { ViewProps } from '../practice/items/types.js';
  import ConfirmSheet from '../../ui/ConfirmSheet.svelte';
  import { finishPlacementRun, skipPlacementRun } from './placement-flow.js';
  import PlacementHeader from './PlacementHeader.svelte';

  let run = $state.raw<QuizRun | null>(
    activity.current?.kind === 'placement' ? $state.snapshot(activity.current.run) : null,
  );
  let answered = $state(false); // this item was answered; "next" moves on
  let busy = $state(false);
  let error = $state('');
  let failedFinish = $state(false);
  let attempt = $state(0);
  let skipping = $state(false);
  let titles = $state<Record<string, Localized>>({});

  const lang = $derived(appState.lang);
  const total = $derived(run?.entries.length ?? 0);
  const index = $derived(
    run ? Math.min(answered ? run.answered.length - 1 : run.answered.length, total - 1) : 0,
  );
  const entry = $derived(run?.entries[index]);
  const track = $derived(entry?.source.kind === 'placement' ? entry.source.track : '');
  const tracks = $derived([
    ...new Set(run?.entries.map((e) => (e.source.kind === 'placement' ? e.source.track : ''))),
  ]);
  const View = $derived(
    entry ? (ITEM_VIEWS[entry.item.type] as unknown as Component<ViewProps<PracticeItem>>) : null,
  );

  $effect(() => {
    if (!activity.current) navigate({ name: 'home' }); // a reload ends the test, unrecorded
  });

  onMount(async () => {
    const manifest = await appState.runtime?.storage.getManifest();
    titles = Object.fromEntries((manifest?.tracks ?? []).map((tr) => [tr.id, tr.title]));
  });

  async function answer(given: Answer): Promise<void> {
    if (!appState.session || !run || busy || answered) return;
    busy = true;
    error = '';
    try {
      run = (await appState.session.answer(run, given)).run;
      if (activity.current) activity.current = { kind: 'placement', run };
      answered = true;
    } catch {
      error = t('profiles.generalError', lang);
      attempt += 1;
    } finally {
      busy = false;
    }
  }

  /** Skipping writes one event; if that fails the learner stays here and is told plainly. */
  async function skip(): Promise<void> {
    skipping = false;
    error = '';
    try {
      await skipPlacementRun();
    } catch {
      error = t('profiles.generalError', lang);
    }
  }

  async function next(): Promise<void> {
    if (!run || !answered || busy) return;
    if (run.answered.length < total) {
      answered = false;
      return;
    }
    busy = true;
    error = '';
    failedFinish = false;
    try {
      await finishPlacementRun();
    } catch {
      error = t('profiles.generalError', lang);
      failedFinish = true;
    } finally {
      busy = false;
    }
  }
</script>

{#if run && entry && View}
  <section class="placement">
    <PlacementHeader
      {lang}
      trackTitle={titles[track]?.[lang] ?? track}
      {tracks}
      current={track}
      onskip={() => (skipping = true)}
    />

    <div class="item">
      {#key `${index}-${attempt}`}
        <View
          item={entry.item}
          {lang}
          storage={appState.runtime!.storage}
          seed={`${entry.item.id}-p`}
          locked={busy || answered}
          onanswer={answer}
          recorder={appState.runtime?.recorder}
        />
      {/key}
      <p class="note">{t('placement.note', lang)}</p>
    </div>

    {#if error}
      <div class="problem" role="alert">
        <p>{error}</p>
        {#if failedFinish}
          <button type="button" class="retry" onclick={next}>{t('practice.retry', lang)}</button>
        {/if}
      </div>
    {/if}

    {#if answered && !failedFinish}
      <button type="button" class="next" disabled={busy} onclick={next}>
        {t('action.next', lang)}
      </button>
    {/if}

    {#if skipping}
      <ConfirmSheet
        message={t('placement.skipConfirm', lang)}
        yes={t('placement.skipYes', lang)}
        no={t('placement.skipNo', lang)}
        onyes={skip}
        onno={() => (skipping = false)}
      />
    {/if}
  </section>
{/if}

<style>
  .placement {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    min-height: 100dvh;
    padding: 18px 20px 22px;
    background: var(--color-card);
  }

  .item {
    display: flex;
    flex-grow: 1;
    flex-direction: column;
    gap: 16px;
  }

  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }

  .problem {
    color: var(--color-wrong);
  }

  .problem p {
    margin: 0 0 8px;
  }

  .next,
  .retry {
    min-height: 52px;
    border-radius: 14px;
    font-size: 17px;
    font-weight: 600;
  }

  .next {
    border: none;
    background: var(--color-primary);
    color: #fff;
  }

  .retry {
    padding: 0 16px;
    border: 1.5px solid var(--color-wrong);
    background: var(--color-card);
    color: var(--color-wrong);
  }

</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import type { PracticeItem } from '@shiksha/content/schema';
  import type { Answer, ItemResult, QuizRun } from '@shiksha/learner-core';
  import { activity, resetActivity } from '../../activity.svelte.js';
  import { appState } from '../../app-state.svelte.js';
  import { t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import Icon from '../../ui/Icon.svelte';
  import LeaveSheet from './LeaveSheet.svelte';
  import FeedbackSheet from './FeedbackSheet.svelte';
  import { finishActivity, saveRecording } from './flow.js';
  import { ITEM_VIEWS } from './items/registry.js';
  import type { ViewProps } from './items/types.js';

  const FULL = 100;

  // Plain data, not a reactive proxy: answers end up inside events that IndexedDB must clone.
  let run = $state.raw<QuizRun | null>(
    activity.current ? $state.snapshot(activity.current.run) : null,
  );
  let result = $state<ItemResult | null>(null);
  let answering = $state(false);
  let leaving = $state(false);
  let finishing = $state(false);
  let error = $state('');
  let failedStep = $state<'answer' | 'finish' | null>(null);
  let attempt = $state(0); // a new number rebuilds the item view, unlocking it after a failed save

  const ui = $derived(appState.lang);
  const itemLang = $derived(activity.current?.kind === 'lesson' ? activity.current.view.primary : ui);
  const total = $derived(run?.entries.length ?? 0);
  /** Stays on the last item while a finished run is being saved: never a blank screen. */
  const index = $derived(
    run ? Math.min(result ? run.answered.length - 1 : run.answered.length, total - 1) : 0,
  );
  const entry = $derived(run?.entries[index]);
  const View = $derived(
    entry ? (ITEM_VIEWS[entry.item.type] as unknown as Component<ViewProps<PracticeItem>>) : null,
  );

  $effect(() => {
    if (!activity.current) navigate({ name: 'lessons' }); // a reload loses the run
  });

  onMount(() => {
    if (activity.finish) navigate({ name: 'finish' }); // came back with Back after finishing
    history.pushState(null, '', window.location.href);
    const onBack = (): void => {
      leaving = true;
      history.pushState(null, '', window.location.href); // stay here until the learner decides
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  });

  async function proceed(): Promise<void> {
    if (!run || run.answered.length < run.entries.length) return;
    finishing = true;
    try {
      await finishActivity();
    } catch {
      error = t('profiles.generalError', ui);
      failedStep = 'finish';
      finishing = false;
    }
  }

  async function answer(given: Answer): Promise<void> {
    if (!appState.session || !run || answering || result || finishing) return;
    answering = true;
    error = '';
    failedStep = null;
    try {
      const out = await appState.session.answer(run, given);
      run = out.run;
      if (activity.current) activity.current = { ...activity.current, run: out.run };
      if (out.result.outcome === 'unscored') await proceed();
      else result = out.result;
    } catch {
      error = t('profiles.generalError', ui); // saving failed: nothing was recorded, so try again
      failedStep = 'answer';
      attempt += 1;
    } finally {
      answering = false;
    }
  }

  async function next(): Promise<void> {
    if (!result || finishing) return;
    result = null;
    error = '';
    await proceed();
  }

  async function retryFinish(): Promise<void> {
    error = '';
    failedStep = null;
    await proceed();
  }

  function leave(): void {
    resetActivity();
    navigate({ name: 'lessons' });
  }
</script>

{#if run && entry && View}
  <section class="practice">
    <header>
      <button type="button" class="close" aria-label={t('practice.close', ui)} onclick={() => (leaving = true)}>
        <Icon name="close" />
      </button>
      <div class="bar"><span style:width={`${(FULL * (index + 1)) / total}%`}></span></div>
      <span class="count">{t('practice.count', ui, { current: index + 1, total })}</span>
    </header>

    <div class="item">
      {#key `${index}-${attempt}`}
        <View
          item={entry.item}
          lang={itemLang}
          storage={appState.runtime!.storage}
          seed={`${entry.item.id}-${index}`}
          locked={answering || finishing || result !== null}
          onanswer={answer}
          recorder={appState.runtime?.recorder}
          onrecord={(recording) => saveRecording(entry, recording)}
        />
      {/key}
    </div>

    {#if error}
      <div class="problem" role="alert">
        <p>{error}</p>
        {#if failedStep === 'finish'}
          <button type="button" onclick={retryFinish}>{t('practice.retry', ui)}</button>
        {/if}
      </div>
    {/if}

    {#if result}
      <FeedbackSheet {result} item={entry.item} lang={itemLang} onnext={next} />
    {/if}

    {#if leaving}
      <LeaveSheet lang={ui} onleave={leave} onstay={() => (leaving = false)} />
    {/if}
  </section>
{/if}

<style>
  .practice {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    background: var(--color-card);
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 16px 8px;
  }

  .close {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--radius-s);
    background: none;
    color: var(--color-muted);
  }

  .bar {
    display: flex;
    flex-grow: 1;
    height: 10px;
    border-radius: 5px;
    background: var(--color-line);
  }

  .bar span {
    border-radius: 5px;
    background: var(--color-streak);
  }

  .count {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
  }

  .item {
    flex-grow: 1;
    padding: 12px 20px;
  }

  .problem {
    padding: 12px 20px;
    background: var(--color-wrong-bg);
    color: var(--color-wrong);
  }

  .problem p {
    margin: 0 0 8px;
  }

  .problem button {
    min-height: 44px;
    padding: 0 16px;
    border: 1.5px solid var(--color-wrong);
    border-radius: 12px;
    background: var(--color-card);
    color: var(--color-wrong);
    font-weight: 600;
  }
</style>

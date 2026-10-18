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
  import FeedbackSheet from './FeedbackSheet.svelte';
  import { finishActivity } from './flow.js';
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

  const ui = $derived(appState.lang);
  const itemLang = $derived(activity.current?.kind === 'lesson' ? activity.current.view.primary : ui);
  const total = $derived(run?.entries.length ?? 0);
  const index = $derived(run ? (result ? run.answered.length - 1 : run.answered.length) : 0);
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
    if (run && run.answered.length >= run.entries.length) await finishActivity();
  }

  async function answer(given: Answer): Promise<void> {
    if (!appState.session || !run || answering || result) return;
    answering = true;
    try {
      const out = await appState.session.answer(run, given);
      run = out.run;
      if (activity.current) activity.current = { ...activity.current, run: out.run } as never;
      if (out.result.outcome === 'unscored') await proceed();
      else result = out.result;
    } finally {
      answering = false;
    }
  }

  async function next(): Promise<void> {
    if (!result) return;
    result = null;
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
      {#key index}
        <View
          item={entry.item}
          lang={itemLang}
          storage={appState.runtime!.storage}
          seed={`${entry.item.id}-${index}`}
          locked={answering || result !== null}
          onanswer={answer}
        />
      {/key}
    </div>

    {#if result}
      <FeedbackSheet {result} item={entry.item} lang={itemLang} onnext={next} />
    {/if}

    {#if leaving}
      <div class="leave" role="alertdialog" aria-label={t('practice.leaveTitle', ui)}>
        <p>{t('practice.leaveTitle', ui)}</p>
        <div class="row">
          <button type="button" class="danger" onclick={leave}>{t('practice.leave', ui)}</button>
          <button type="button" onclick={() => (leaving = false)}>{t('practice.stay', ui)}</button>
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .practice {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
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

  .leave {
    position: fixed;
    inset: auto 0 0;
    max-width: 480px;
    margin: 0 auto;
    padding: 20px;
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    background: var(--color-card);
    box-shadow: 0 -4px 24px rgb(0 0 0 / 20%);
  }

  .leave p {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .row button {
    flex: 1;
    min-height: 48px;
    border: 1.5px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-card);
    font-weight: 600;
  }

  .row .danger {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }
</style>

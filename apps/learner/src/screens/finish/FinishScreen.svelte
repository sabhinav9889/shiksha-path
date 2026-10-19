<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { activity, resetActivity } from '../../activity.svelte.js';
  import { appState } from '../../app-state.svelte.js';
  import { t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import SyncChip from '../home/SyncChip.svelte';
  import Icon from '../../ui/Icon.svelte';

  const ICON_SIZE = 48;
  const PERCENT = 100;

  let sync = $state<{ lastSyncedAt: string | null; pending: number } | null>(null);

  const info = $derived(activity.finish);
  const lang = $derived(appState.lang);
  const title = $derived.by(() => {
    if (!info) return '';
    if (info.kind === 'review') return t('finish.review', lang);
    if (info.kind === 'test_out') {
      return t(info.testOut?.passed ? 'finish.testPassed' : 'finish.testFailed', lang);
    }
    return t('finish.lesson', lang, { title: info.lessonTitle?.[lang] ?? '' });
  });

  $effect(() => {
    if (!info) navigate({ name: 'home' }); // nothing to show (a reload): go home
  });

  onMount(async () => {
    const { runtime, profile } = appState;
    if (runtime && profile) sync = await runtime.syncStatus(profile.id);
  });

  /** However the learner leaves this screen, the finished run is over. */
  onDestroy(resetActivity);

  function home(): void {
    resetActivity();
    navigate({ name: 'home' });
  }
</script>

{#if info}
  <section class="finish">
    <div class="hero">
      <span class="badge"><Icon name="check" size={ICON_SIZE} /></span>
      <h1>{title}</h1>
      {#if info.testOut}
        <p>{t('finish.testScore', lang, { percent: Math.round(info.testOut.score * PERCENT) })}</p>
      {:else}
        <p>
          {t('finish.summary', lang, {
            scored: info.summary.scored,
            correct: info.summary.correct,
            days: info.streak.current,
          })}
        </p>
      {/if}

      <div class="tiles">
        <div class="tile">
          <strong>{info.summary.correct}</strong>
          <span>{t('finish.tileCorrect', lang)}</span>
        </div>
        <div class="tile">
          <strong>{info.summary.wrong}</strong>
          <span>{t('finish.tileWrong', lang)}</span>
        </div>
        <div class="tile streak">
          <strong>{info.streak.current}</strong>
          <span>{t('finish.tileStreak', lang)}</span>
        </div>
      </div>

      {#if info.summary.wrong > 0 && info.kind !== 'test_out'}
        <p class="note">{t('finish.mistakes', lang, { count: info.summary.wrong })}</p>
      {/if}
    </div>

    {#if sync}
      <div class="sync">
        <SyncChip
          lastSyncedAt={sync.lastSyncedAt}
          pending={sync.pending}
          now={appState.runtime?.clock.now() ?? new Date()}
          {lang}
        />
      </div>
    {/if}
    <button type="button" onclick={home}>{t('finish.home', lang)}</button>
  </section>
{/if}

<style>
  .finish {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    min-height: 100dvh;
    padding: 28px 20px 22px;
    background: var(--color-card);
  }

  .hero {
    display: flex;
    flex-grow: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: center;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: var(--color-correct-bg);
    color: var(--color-correct);
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 30px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: #3a3f5c;
    font-size: 17px;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
    margin-top: 6px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 6px;
    border-radius: 14px;
    background: var(--color-bg);
  }

  .tile.streak {
    background: #fdf0dd;
    color: #8a4b06;
  }

  .tile strong {
    font-family: var(--font-heading);
    font-size: 24px;
  }

  .tile span {
    font-size: 13px;
  }

  .note {
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--color-bg);
    font-size: 14px;
    text-align: left;
  }

  .sync {
    display: flex;
    justify-content: center;
  }

  button {
    min-height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { CoreError } from '@shiksha/learner-core';
  import { activity } from '../../activity.svelte.js';
  import { appState, refreshSession } from '../../app-state.svelte.js';
  import { errorMessage, t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import DownloadCard from './DownloadCard.svelte';
  import { loadHome, type HomeData } from './home-data.js';
  import StatCards from './StatCards.svelte';
  import SyncChip from './SyncChip.svelte';
  import TodayCard from './TodayCard.svelte';

  let data = $state<HomeData | null>(null);
  let busy = $state(false);
  let working = $state(false);
  let error = $state('');

  const lang = $derived(appState.lang);

  async function load(): Promise<void> {
    const { runtime, profile, session } = appState;
    if (runtime && profile) data = await loadHome(runtime, profile.id, session);
  }

  async function refresh(): Promise<void> {
    await refreshSession();
    await load();
  }

  onMount(() => {
    const content = appState.runtime?.content;
    busy = content?.busy ?? false;
    void load();
    return content?.subscribe(() => {
      busy = content.busy;
      if (!busy) void refresh();
    });
  });

  function explain(failure: unknown): string {
    if (failure instanceof CoreError) return errorMessage(failure.code, lang, failure.details);
    return t('profiles.generalError', lang);
  }

  async function download(): Promise<void> {
    const content = appState.runtime?.content;
    if (!content) return;
    error = '';
    const result = await content.sync();
    if (!result.ok) {
      error = errorMessage(result.error, lang);
      return;
    }
    await refresh();
    const failed = result.value.modules.find((m) => m.status === 'failed');
    if (data?.state === 'download' && failed?.error) {
      error = errorMessage(failed.error, lang, failed.details);
    }
  }

  async function startLesson(): Promise<void> {
    const lessonId = data?.today?.lessonId;
    if (!appState.session || !lessonId || working) return;
    working = true;
    try {
      activity.current = { kind: 'lesson', ...(await appState.session.startLesson(lessonId)) };
      navigate({ name: 'learn', lessonId });
    } catch (failure) {
      error = explain(failure);
    } finally {
      working = false;
    }
  }

  async function startReview(): Promise<void> {
    if (!appState.session || working) return;
    working = true;
    try {
      const run = await appState.session.startReview();
      if (!run) return;
      activity.current = { kind: 'review', run };
      navigate({ name: 'practice' });
    } catch (failure) {
      error = explain(failure);
    } finally {
      working = false;
    }
  }
</script>

{#if data}
  <section class="home">
    <header>
      <h1>{t('home.greeting', lang, { name: appState.profile?.name ?? '' })}</h1>
      <SyncChip
        lastSyncedAt={data.sync.lastSyncedAt}
        pending={data.sync.pending}
        now={appState.runtime?.clock.now() ?? new Date()}
        {lang}
      />
    </header>

    {#if data.state !== 'download'}
      <StatCards {lang} streak={data.streak} tracks={data.tracks} />
    {/if}

    {#if data.state === 'download'}
      <DownloadCard {lang} {busy} {error} ondownload={download} />
    {:else if data.state === 'ready' && data.today}
      <TodayCard
        {lang}
        title={data.today.title[lang]}
        questions={data.today.questions}
        busy={working}
        onstart={startLesson}
      />
    {:else}
      <section class="card done">
        <h2>{t('home.allDone', lang)}</h2>
        <p>{t('home.allDoneBody', lang)}</p>
      </section>
    {/if}

    {#if data.reviewDue > 0}
      <button type="button" class="card review" onclick={startReview}>
        <strong>{t('home.review', lang, { count: data.reviewDue })}</strong>
        <span>{t('home.reviewSub', lang)}</span>
      </button>
    {/if}

    {#if error && data.state !== 'download'}
      <p class="error" role="alert">{error}</p>
    {/if}
  </section>
{/if}

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 16px 16px;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 26px;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: none;
    border-radius: var(--radius-m);
    background: var(--color-card);
    color: var(--color-ink);
    text-align: left;
  }

  .done h2,
  .done p,
  .review span {
    margin: 0;
  }

  .review span {
    color: var(--color-muted);
    font-size: 13px;
  }

  .review strong {
    font-size: 16px;
    font-family: var(--font-body);
  }

  .error {
    margin: 0;
    color: var(--color-wrong);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { CoreError, type SyncReport } from '@shiksha/learner-core';
  import { activity } from '../../activity.svelte.js';
  import { appState, refreshSession } from '../../app-state.svelte.js';
  import { errorMessage, failureMessage, t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import DownloadCard from '../home/DownloadCard.svelte';
  import { loadLessons, type LessonsData } from './lessons-data.js';
  import ModuleCard from './ModuleCard.svelte';

  let data = $state<LessonsData | null>(null);
  let trackId = $state<string | null>(null);
  let busy = $state(false);
  let working = $state(false);
  let errors = $state<Record<string, string>>({});
  let general = $state('');

  const lang = $derived(appState.lang);
  const shown = $derived(data?.modules.filter((m) => m.track === trackId) ?? []);

  async function load(): Promise<void> {
    const { runtime, session } = appState;
    if (!runtime) return;
    data = await loadLessons(runtime, session);
    trackId = data.tracks.some((tr) => tr.id === trackId) ? trackId : (data.tracks[0]?.id ?? null);
  }

  async function refresh(): Promise<void> {
    await refreshSession();
    await load();
  }

  onMount(() => {
    const content = appState.runtime?.content;
    busy = content?.busy ?? false;
    void refresh(); // a sync may have finished while another screen was open
    return content?.subscribe(() => {
      busy = content.busy;
      if (!busy) void refresh();
    });
  });

  function explain(failure: unknown): string {
    if (failure instanceof CoreError) return errorMessage(failure.code, lang, failure.details);
    return t('profiles.generalError', lang);
  }

  async function guarded(moduleId: string | null, work: () => Promise<void>): Promise<void> {
    if (working) return;
    working = true;
    errors = {};
    general = '';
    try {
      await work();
    } catch (failure) {
      if (moduleId) errors[moduleId] = explain(failure);
      else general = explain(failure);
    } finally {
      working = false;
    }
  }

  /** A sync reports each module's outcome; show a failure next to the module it belongs to. */
  function showReport(modules: SyncReport['modules']): void {
    for (const m of modules) if (m.error) errors[m.id] = failureMessage(m.error, lang, m.details);
  }

  const download = (): Promise<void> =>
    guarded(null, async () => {
      const result = await appState.runtime?.content.sync();
      if (result && !result.ok) general = errorMessage(result.error, lang);
      if (result?.ok) showReport(result.value.modules);
      await refresh();
    });

  const restore = (id: string): Promise<void> =>
    guarded(id, async () => {
      const result = await appState.runtime?.content.restore(id);
      if (result && !result.ok) errors[id] = errorMessage(result.error, lang);
      if (result?.ok) showReport(result.value.modules);
      await refresh();
    });

  const remove = (id: string): Promise<void> =>
    guarded(id, async () => {
      await appState.runtime?.content.remove(id);
      await refresh();
    });

  const fetchAudio = (id: string): Promise<void> =>
    guarded(id, async () => {
      const result = await appState.runtime?.content.fetchAudio(id);
      if (result && !result.ok) errors[id] = errorMessage(result.error, lang);
      await refresh();
    });

  const startLesson = (lessonId: string): Promise<void> =>
    guarded(null, async () => {
      if (!appState.session) return;
      activity.current = { kind: 'lesson', ...(await appState.session.startLesson(lessonId)) };
      navigate({ name: 'learn', lessonId });
    });

  const startTestOut = (moduleId: string): Promise<void> =>
    guarded(moduleId, async () => {
      if (!appState.session) return;
      const started = await appState.session.startTestOut(moduleId);
      activity.current = { kind: 'test_out', moduleId, ...started };
      navigate({ name: 'practice' });
    });
</script>

{#if data}
  <section class="lessons">
    <h1>{t('lessons.title', lang)}</h1>

    {#if data.tracks.length === 0}
      <DownloadCard {lang} {busy} error={general} ondownload={download} />
    {:else}
      <div class="tabs">
        {#each data.tracks as track (track.id)}
          <button
            type="button"
            aria-pressed={track.id === trackId}
            class:selected={track.id === trackId}
            onclick={() => (trackId = track.id)}
          >
            {track.title[lang]}
          </button>
        {/each}
      </div>
      {#each shown as module (module.id)}
        <ModuleCard
          {lang}
          {module}
          busy={busy || working}
          error={errors[module.id] ?? ''}
          onlesson={startLesson}
          ontestout={() => startTestOut(module.id)}
          ondownload={download}
          onremove={() => remove(module.id)}
          onrestore={() => restore(module.id)}
          onaudio={() => fetchAudio(module.id)}
        />
      {/each}
      {#if general}
        <p class="error" role="alert">{general}</p>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .lessons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 16px 16px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 26px;
    line-height: 1.1;
  }

  .tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 6px;
    padding: 4px;
    border-radius: 14px;
    background: var(--color-line);
  }

  .tabs button {
    min-height: 44px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--color-muted);
    font-size: 15px;
    font-weight: 600;
  }

  .tabs button.selected {
    background: var(--color-card);
    color: var(--color-primary-dark);
  }

  .error {
    margin: 0;
    color: var(--color-wrong);
  }
</style>

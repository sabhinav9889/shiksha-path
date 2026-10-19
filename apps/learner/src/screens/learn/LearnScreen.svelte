<script lang="ts">
  import { activity, resetActivity } from '../../activity.svelte.js';
  import { appState } from '../../app-state.svelte.js';
  import { t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import Icon from '../../ui/Icon.svelte';
  import AudioButton from './AudioButton.svelte';

  const ARROW_SIZE = 18;

  const current = $derived(activity.current?.kind === 'lesson' ? activity.current : null);

  /** `null` until the learner taps the toggle: then the lesson's own default language is shown. */
  let chosen = $state<'hi' | 'en' | null>(null);
  const shown = $derived(chosen ?? current?.view.primary ?? 'hi');
  const ui = $derived(appState.lang);

  $effect(() => {
    if (!current) navigate({ name: 'lessons' }); // a reload loses the run: go back to the list
  });

  function toggle(): void {
    if (!current) return;
    const { primary, toggle: other } = current.view;
    chosen = shown === primary ? other : primary;
  }

  function back(): void {
    resetActivity();
    navigate({ name: 'lessons' });
  }

  async function fetchAudio(): Promise<void> {
    const { runtime } = appState;
    if (!runtime || !current) return;
    const manifest = await runtime.storage.getManifest();
    const lessonId = current.lesson.id;
    const owner = manifest?.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    if (owner) await runtime.content.fetchAudio(owner.id);
  }
</script>

{#if current}
  <section class="learn">
    <header>
      <button type="button" class="back" aria-label={t('action.back', ui)} onclick={back}>
        <Icon name="back" />
      </button>
      {#if current.view.toggle !== null}
        <button type="button" class="toggle" onclick={toggle}>
          {t(shown === 'hi' ? 'learn.viewEn' : 'learn.viewHi', ui)}
        </button>
      {/if}
    </header>

    <h1>{current.lesson.title[shown]}</h1>
    {#if appState.runtime}
      <AudioButton
        storage={appState.runtime.storage}
        path={current.lesson.audio?.[shown]}
        label={t('learn.listen', ui)}
        onmissing={fetchAudio}
      />
    {/if}
    <div class="html">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own verified build -->
      {@html current.lesson.html[shown]}
    </div>

    <button type="button" class="practice" onclick={() => navigate({ name: 'practice' })}>
      {t('learn.practice', ui)}
      <Icon name="arrow" size={ARROW_SIZE} />
    </button>
  </section>
{/if}

<style>
  .learn {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: 12px 16px 24px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--radius-s);
    background: none;
    color: var(--color-muted);
  }

  .toggle {
    border: none;
    background: none;
    color: var(--color-primary);
    font-weight: 600;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 28px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .html {
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  .html :global(p) {
    margin: 0 0 12px;
  }

  .html :global(ul),
  .html :global(ol) {
    margin: 0 0 12px;
    padding-left: 22px;
  }

  .practice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }
</style>

<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';
  import type { ModuleView } from './lessons-data.js';
  import LessonList from './LessonList.svelte';

  const FULL = 100;

  interface Props {
    lang: Lang;
    module: ModuleView;
    busy: boolean;
    error: string;
    onlesson: (id: string) => void;
    ontestout: () => void;
    ondownload: () => void;
    onremove: () => void;
    onrestore: () => void;
    onaudio: () => void;
  }

  let { lang, module, busy, error, ...actions }: Props = $props();

  let confirming = $state(false);
  const usable = $derived(module.state === 'ready' || module.state === 'playable');
  const finished = $derived(module.state === 'ready' && module.done === module.lessons.length);
</script>

<section class="module">
  <header>
    <h2>{module.title[lang]}</h2>
    <span>{t('home.progress', lang, { done: module.done, total: module.lessons.length })}</span>
  </header>
  <div class="bar">
    <span style:width={`${module.lessons.length ? (FULL * module.done) / module.lessons.length : 0}%`}
    ></span>
  </div>

  {#if usable}
    <LessonList {lang} {module} onlesson={actions.onlesson} ontestout={actions.ontestout} />
    {#if module.audioMissing}
      <button type="button" class="link" disabled={busy} onclick={actions.onaudio}>
        {t('lessons.audio', lang)}
      </button>
    {/if}
    {#if finished && !confirming}
      <button type="button" class="link" onclick={() => (confirming = true)}>
        {t('lessons.remove', lang)}
      </button>
    {/if}
    {#if confirming}
      <div class="confirm">
        <p>{t('lessons.removeConfirm', lang)}</p>
        <div class="row">
          <button type="button" class="danger" onclick={actions.onremove}>{t('lessons.removeYes', lang)}</button>
          <button type="button" onclick={() => (confirming = false)}>{t('lessons.removeNo', lang)}</button>
        </div>
      </div>
    {/if}
  {:else if module.state === 'removed'}
    <p class="note">{t('lessons.removedNote', lang)}</p>
    <button type="button" class="primary" disabled={busy} onclick={actions.onrestore}>
      {t('lessons.restore', lang)}
    </button>
  {:else}
    <button type="button" class="primary" disabled={busy} onclick={actions.ondownload}>
      {busy ? t('home.downloading', lang) : t('action.download', lang)}
    </button>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</section>

<style>
  .module {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  header {
    display: flex;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    min-width: 0;
    font-size: 17px;
    overflow-wrap: anywhere;
  }

  header span {
    color: var(--color-muted);
    font-size: 14px;
  }

  .bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    background: var(--color-line);
  }

  .bar span {
    border-radius: 3px;
    background: var(--color-primary);
  }

  .primary {
    min-height: 48px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
  }

  .primary:disabled {
    opacity: 0.6;
  }

  .link {
    align-self: flex-start;
    border: none;
    background: none;
    color: var(--color-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .confirm p,
  .note,
  .error {
    margin: 0;
  }

  .note {
    color: var(--color-muted);
  }

  .error {
    color: var(--color-wrong);
  }

  .row {
    display: flex;
    gap: 10px;
    margin-top: 8px;
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

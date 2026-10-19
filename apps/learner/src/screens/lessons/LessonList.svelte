<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';
  import type { ModuleView } from './lessons-data.js';

  const MARKS = { done: '✓', today: '▶', open: '·' } as const;

  interface Props {
    lang: Lang;
    module: ModuleView;
    onlesson: (id: string) => void;
    ontestout: () => void;
  }

  let { lang, module, onlesson, ontestout }: Props = $props();
</script>

<ul>
      {#each module.lessons as lesson (lesson.id)}
        <li data-status={lesson.status} class={lesson.status}>
          <button type="button" onclick={() => onlesson(lesson.id)}>
            <span class="badge" aria-hidden="true">{MARKS[lesson.status]}</span>
            <span class="title">{lesson.title[lang]}</span>
          </button>
        </li>
      {/each}
      {#if module.testOut !== 'none'}
        <li data-status={module.testOut === 'passed' ? 'done' : 'open'} class="quiz">
          <button type="button" onclick={ontestout}>
            <span class="badge" aria-hidden="true">{module.testOut === 'passed' ? '✓' : 'Q'}</span>
            <span class="title">
              {t('lessons.testOut', lang)}
              <small>
                {module.testOut === 'passed' ? t('lessons.testedOut', lang) : t('lessons.testOutSub', lang)}
              </small>
            </span>
          </button>
        </li>
      {/if}
    </ul>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 10px 12px;
    border: 2px solid var(--color-card);
    border-radius: 14px;
    background: var(--color-card);
    color: var(--color-ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }

  li.today button {
    border-color: var(--color-primary);
  }

  .badge {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #eef0f5;
    color: #6b7084;
    font-weight: 700;
  }

  .done .badge {
    background: var(--color-correct-bg);
    color: var(--color-correct);
  }

  .today .badge {
    background: var(--color-primary);
    color: #fff;
  }

  .quiz .badge {
    background: #fdf0dd;
    color: #8a4b06;
  }

  .title {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  small {
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 400;
  }
</style>

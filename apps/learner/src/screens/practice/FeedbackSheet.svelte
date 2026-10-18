<script lang="ts">
  import type { PracticeItem } from '@shiksha/content/schema';
  import type { ItemResult } from '@shiksha/learner-core';
  import { t, type Lang } from '../../i18n/index.js';
  import { correctAnswerText } from './feedback-text.js';

  interface Props {
    result: ItemResult;
    item: PracticeItem | undefined;
    lang: Lang;
    onnext: () => void;
  }

  let { result, item, lang, onnext }: Props = $props();

  const right = $derived(result.outcome === 'correct');
</script>

<div class="sheet" class:right role="status">
  <h2>{right ? t('practice.correct', lang) : t('practice.whyWrong', lang)}</h2>
  {#if result.whyWrong}
    <p>{result.whyWrong[lang]}</p>
  {/if}
  {#if result.explanation}
    <p><strong>{t('practice.explanation', lang)}:</strong> {result.explanation[lang]}</p>
  {/if}
  {#if result.correctAnswer}
    <p>
      {t('practice.correctAnswer', lang, {
        answer: correctAnswerText(result.correctAnswer, item, lang),
      })}
    </p>
  {/if}
  <button type="button" onclick={onnext}>{t('action.next', lang)}</button>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 20px 20px;
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    background: var(--color-wrong-bg);
    color: #3a1d1a;
  }

  .sheet.right {
    background: var(--color-correct-bg);
    color: #173d25;
  }

  h2 {
    margin: 0;
    color: var(--color-wrong);
    font-family: var(--font-heading);
    font-size: 20px;
  }

  .right h2 {
    color: var(--color-correct);
  }

  p {
    margin: 0;
    line-height: 1.5;
  }

  button {
    min-height: 48px;
    border: none;
    border-radius: 14px;
    background: var(--color-wrong);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
  }

  .right button {
    background: var(--color-correct);
  }
</style>

<script lang="ts">
  import { shuffleItems } from '@shiksha/learner-core';
  import AudioButton from '../../learn/AudioButton.svelte';
  import { t } from '../../../i18n/index.js';
  import type { ItemOf, ViewProps } from './types.js';

  const LETTERS = 'ABCDEF';

  let { item, lang, storage, seed, locked, onanswer }: ViewProps<
    ItemOf<'mcq_meaning' | 'listen_choose' | 'aptitude'>
  > = $props();

  /** Authors often list the right answer first, so the order is shuffled for each question. */
  const options = $derived(shuffleItems(item.options, seed));
  let picked = $state<string | null>(null);

  function pick(optionId: string): void {
    if (locked || picked !== null) return;
    picked = optionId;
    onanswer({ kind: 'choice', optionId });
  }
</script>

<div class="choice">
  <p class="prompt">{item.prompt[lang]}</p>
  {#if item.type === 'listen_choose'}
    <AudioButton {storage} path={item.audio} label={t('practice.listen', lang)} />
  {/if}
  <div class="options">
    {#each options as option, index (option.id)}
      <button
        type="button"
        class:picked={picked === option.id}
        disabled={locked || picked !== null}
        onclick={() => pick(option.id)}
      >
        <span class="letter">{LETTERS[index]}</span>
        <span class="text">{option.text[lang]}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .choice {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 10px 14px;
    border: 2px solid var(--color-line);
    border-radius: var(--radius-m);
    background: var(--color-card);
    color: var(--color-ink);
    font-size: 17px;
    text-align: left;
  }

  button.picked {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  .letter {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1.5px solid #c9cde0;
    border-radius: 9px;
    font-size: 14px;
    font-weight: 600;
  }

  .text {
    flex-grow: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>

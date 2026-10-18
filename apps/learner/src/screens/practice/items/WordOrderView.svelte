<script lang="ts">
  import { shuffleWords } from '@shiksha/learner-core';
  import { t } from '../../../i18n/index.js';
  import type { ItemOf, ViewProps } from './types.js';

  let { item, lang, seed, locked, onanswer }: ViewProps<ItemOf<'word_order'>> = $props();

  /** Each word keeps an id, so a sentence with the same word twice still works. */
  const bank = $derived(shuffleWords(item.words, seed).map((word, id) => ({ id, word })));
  let placed = $state<number[]>([]);
  let sent = $state(false);

  const disabled = $derived(locked || sent);
  const waiting = $derived(bank.filter((entry) => !placed.includes(entry.id)));
  const tray = $derived(placed.map((id) => bank[id]).filter((entry) => entry !== undefined));

  function place(id: number): void {
    if (!disabled) placed = [...placed, id];
  }

  function take(id: number): void {
    if (!disabled) placed = placed.filter((placedId) => placedId !== id);
  }

  function check(): void {
    if (disabled || placed.length !== bank.length) return;
    sent = true;
    onanswer({ kind: 'order', words: tray.map((entry) => entry.word) });
  }
</script>

<div class="order">
  <p class="prompt">{item.prompt[lang]}</p>
  <div class="tray" data-testid="tray" aria-label={t('practice.tray', lang)}>
    {#each tray as entry (entry.id)}
      <button type="button" data-word={entry.word} {disabled} onclick={() => take(entry.id)}>
        {entry.word}
      </button>
    {/each}
  </div>
  <div class="bank" data-testid="bank" aria-label={t('practice.bank', lang)}>
    {#each waiting as entry (entry.id)}
      <button type="button" data-word={entry.word} {disabled} onclick={() => place(entry.id)}>
        {entry.word}
      </button>
    {/each}
  </div>
  <button
    type="button"
    class="check"
    disabled={disabled || placed.length !== bank.length}
    onclick={check}
  >
    {t('practice.check', lang)}
  </button>
</div>

<style>
  .order {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .tray,
  .bank {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 60px;
    padding: 8px;
    border-radius: var(--radius-m);
  }

  .tray {
    border: 2px dashed #c9cde0;
  }

  .tray button,
  .bank button {
    min-height: 48px;
    padding: 0 16px;
    border: 2px solid var(--color-line);
    border-radius: var(--radius-s);
    background: var(--color-card);
    color: var(--color-ink);
    font-size: 17px;
  }

  .tray button {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  .check {
    min-height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }

  .check:disabled {
    opacity: 0.4;
  }
</style>

<script lang="ts">
  import { t } from '../../../i18n/index.js';
  import type { ItemOf, ViewProps } from './types.js';

  const BLANK = '___';

  let { item, lang, locked, onanswer }: ViewProps<ItemOf<'fill_blank'>> = $props();

  let value = $state('');
  let sent = $state(false);

  const [before = '', after = ''] = $derived(item.sentence.split(BLANK));
  const disabled = $derived(locked || sent);

  /** The text goes out exactly as typed; the core decides what counts as the same answer. */
  function check(): void {
    if (disabled || value.trim() === '') return;
    sent = true;
    onanswer({ kind: 'text', value });
  }
</script>

<div class="fill">
  <p class="prompt">{item.prompt[lang]}</p>
  <p class="sentence">
    {before}
    <input
      type="text"
      aria-label={t('practice.yourAnswer', lang)}
      autocomplete="off"
      autocapitalize="off"
      {disabled}
      bind:value
    />
    {after}
  </p>
  <button type="button" disabled={disabled || value.trim() === ''} onclick={check}>
    {t('practice.check', lang)}
  </button>
</div>

<style>
  .fill {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .sentence {
    margin: 0;
    font-size: 20px;
    line-height: 2.2;
  }

  input {
    min-height: 48px;
    width: 9em;
    max-width: 100%;
    padding: 0 12px;
    border: 2px solid var(--color-line);
    border-radius: var(--radius-s);
    font-family: inherit;
    font-size: 18px;
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

  button:disabled {
    opacity: 0.4;
  }
</style>

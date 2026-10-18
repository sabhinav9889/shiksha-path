<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';

  const PIN_LENGTH = 4;
  const DOTS = Array.from({ length: PIN_LENGTH }, (_, i) => i);
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  let {
    lang,
    onsubmit,
    disabled = false,
    error = '',
  }: { lang: Lang; onsubmit: (pin: string) => void; disabled?: boolean; error?: string } = $props();

  let digits = $state('');

  /** The PIN is never rendered; the dots only count. It clears itself once it is handed over. */
  function press(key: string): void {
    if (disabled) return;
    if (key === '⌫') {
      digits = digits.slice(0, -1);
      return;
    }
    if (digits.length >= PIN_LENGTH) return;
    digits += key;
    if (digits.length === PIN_LENGTH) {
      const pin = digits;
      digits = '';
      onsubmit(pin);
    }
  }
</script>

<div class="pad">
  <div class="dots" role="img" aria-label={t('pin.dots', lang, { entered: digits.length })}>
    {#each DOTS as dot (dot)}
      <span class="dot" class:filled={dot < digits.length}></span>
    {/each}
  </div>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  <div class="keys">
    {#each KEYS as key (key || 'empty')}
      {#if key === ''}
        <span></span>
      {:else}
        <button
          type="button"
          {disabled}
          aria-label={key === '⌫' ? t('pin.delete', lang) : key}
          onclick={() => press(key)}
        >
          {key}
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .pad {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
  }

  .dots {
    display: flex;
    gap: 14px;
  }

  .dot {
    width: 16px;
    height: 16px;
    border: 2px solid #c9cde0;
    border-radius: 50%;
  }

  .dot.filled {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  .error {
    margin: 0;
    color: var(--color-wrong);
    font-size: 15px;
    text-align: center;
  }

  .keys {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }

  button {
    min-height: 56px;
    border: none;
    border-radius: 14px;
    background: var(--color-bg);
    color: var(--color-ink);
    font-size: 22px;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>

<script lang="ts">
  import { t } from '../../../i18n/index.js';
  import AudioButton from '../../learn/AudioButton.svelte';
  import type { ItemOf, ViewProps } from './types.js';

  let { item, lang, storage, locked, onanswer }: ViewProps<ItemOf<'speak_compare'>> = $props();

  let sent = $state(false);

  /** Recording arrives in Plan 2c; until then a speaking item is listened to and skipped. */
  function next(): void {
    if (locked || sent) return;
    sent = true;
    onanswer({ kind: 'spoken' });
  }
</script>

<div class="speak">
  <p class="prompt">{item.prompt[lang]}</p>
  <p class="text">{item.text}</p>
  <AudioButton {storage} path={item.model_audio} label={t('practice.listen', lang)} />
  <p class="note">{t('practice.speakNote', lang)}</p>
  <button type="button" disabled={locked || sent} onclick={next}>{t('action.next', lang)}</button>
</div>

<style>
  .speak {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .prompt {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .text {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 26px;
    line-height: 1.2;
  }

  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: 14px;
  }

  button {
    align-self: stretch;
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

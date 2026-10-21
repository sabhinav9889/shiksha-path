<script lang="ts">
  import { appState } from '../../../app-state.svelte.js';
  import { t } from '../../../i18n/index.js';
  import AudioButton from '../../learn/AudioButton.svelte';
  import RecordPanel from './RecordPanel.svelte';
  import type { ItemOf, ViewProps } from './types.js';

  let { item, lang, storage, locked, onanswer, recorder, onrecord }: ViewProps<
    ItemOf<'speak_compare'>
  > = $props();

  /** Never scored (spec §6.5): recording is optional and "next" always works. */
  const next = (): void => onanswer({ kind: 'spoken' });
</script>

<div class="speak">
  <p class="prompt">{item.prompt[lang]}</p>
  <p class="text">{item.text}</p>
  <AudioButton {storage} path={item.model_audio} label={t('practice.listen', lang)} />
  {#if appState.switches.speaking_practice}
    <RecordPanel {lang} {recorder} {locked} {onrecord} onnext={next} />
  {:else}
    <button type="button" class="next" disabled={locked} onclick={next}>
      {t('action.next', lang)}
    </button>
  {/if}
</div>

<style>
  .speak {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .text {
    margin: 0;
    min-height: 44px;
    font-family: var(--font-heading);
    font-size: 26px;
    line-height: 1.2;
  }

  .next {
    min-height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }

  .next:disabled {
    opacity: 0.4;
  }
</style>

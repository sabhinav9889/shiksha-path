<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { RecorderError, MAX_RECORDING_MS, type Recorder, type RecordingResult } from '../../../audio/recorder.js';
  import { recordingObjectUrl } from '../../../audio/recording-source.js';
  import { t, type Lang } from '../../../i18n/index.js';

  type Phase = 'idle' | 'recording' | 'saving' | 'recorded' | 'denied' | 'unsupported' | 'failed';

  const MS_PER_SECOND = 1000;
  const FULL_SECONDS = MAX_RECORDING_MS / MS_PER_SECOND;

  interface Props {
    lang: Lang;
    recorder: Recorder | undefined;
    locked: boolean;
    onrecord: ((recording: RecordingResult) => Promise<void>) | undefined;
    onnext: () => void;
  }

  let { lang, recorder, locked, onrecord, onnext }: Props = $props();

  let phase = $state<Phase>(recorder?.isSupported() ? 'idle' : 'unsupported');
  let secondsLeft = $state(FULL_SECONDS);
  let last: RecordingResult | null = null;
  let src = $state<string | null>(null);
  let audio = $state<HTMLAudioElement>();
  let release: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let sent = false;

  const MESSAGES = { denied: 'speak.denied', unsupported: 'speak.unsupported', failed: 'speak.failed' } as const;
  const message = $derived(phase in MESSAGES ? MESSAGES[phase as keyof typeof MESSAGES] : null);

  function stopTimer(): void {
    clearInterval(timer);
    timer = undefined;
  }

  async function record(): Promise<void> {
    if (!recorder || locked || phase === 'recording' || phase === 'saving') return;
    try {
      await recorder.start();
    } catch (error) {
      const kind = error instanceof RecorderError ? error.kind : 'failed';
      phase = kind === 'denied' || kind === 'unsupported' ? kind : 'failed';
      return;
    }
    phase = 'recording';
    secondsLeft = FULL_SECONDS;
    timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) void finish();
    }, MS_PER_SECOND);
  }

  /** Stop and save before the learner can do anything else with this item. */
  async function finish(): Promise<void> {
    if (!recorder || phase !== 'recording') return;
    stopTimer();
    phase = 'saving';
    try {
      const result = await recorder.stop();
      await onrecord?.(result);
      last = result;
      phase = 'recorded';
    } catch {
      phase = 'failed';
    }
  }

  function freePlayback(): void {
    release?.();
    release = null;
    src = null;
  }

  async function play(): Promise<void> {
    if (!last || src) return;
    const source = recordingObjectUrl(last);
    release = source.revoke;
    src = source.url;
    await tick();
    await audio?.play();
  }

  function next(): void {
    if (locked || sent) return;
    if (phase === 'recording') {
      stopTimer();
      recorder?.cancel();
    }
    sent = true;
    onnext();
  }

  onDestroy(() => {
    stopTimer();
    if (phase === 'recording') recorder?.cancel();
    freePlayback();
  });
</script>

<div class="panel">
  {#if message}
    <p class="note problem" role="alert">{t(message, lang)}</p>
  {:else}
    <p class="note">{t('speak.privacy', lang)}</p>
  {/if}

  {#if phase === 'recording'}
    <button type="button" class="record live" onclick={finish}>{t('speak.stop', lang)}</button>
    <span class="seconds">{t('speak.secondsLeft', lang, { seconds: secondsLeft })}</span>
  {:else if phase === 'saving'}
    <span class="seconds">{t('speak.saving', lang)}</span>
  {:else if phase === 'recorded'}
    <span class="saved">{t('speak.saved', lang)}</span>
    <button type="button" class="secondary" disabled={locked} onclick={play}>{t('speak.playMine', lang)}</button>
    <button type="button" class="secondary" disabled={locked} onclick={record}>{t('speak.again', lang)}</button>
    {#if src}
      <audio bind:this={audio} {src} onended={freePlayback} preload="none"></audio>
    {/if}
  {:else if phase === 'idle' || phase === 'failed'}
    <button type="button" class="record" disabled={locked} onclick={record}>{t('speak.record', lang)}</button>
  {/if}

  <button type="button" class="next" disabled={locked || phase === 'saving'} onclick={next}>
    {t('action.next', lang)}
  </button>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: 14px;
  }

  .problem {
    color: var(--color-wrong);
  }

  .seconds,
  .saved {
    color: var(--color-muted);
    font-weight: 600;
  }

  .saved {
    color: var(--color-correct);
  }

  button {
    min-height: 52px;
    border-radius: 14px;
    font-size: 17px;
    font-weight: 600;
  }

  .record {
    border: none;
    background: var(--color-wrong);
    color: #fff;
  }

  .record.live {
    background: var(--color-ink);
  }

  .secondary {
    border: 1.5px solid var(--color-primary);
    background: var(--color-card);
    color: var(--color-primary);
  }

  .next {
    border: none;
    background: var(--color-primary);
    color: #fff;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>

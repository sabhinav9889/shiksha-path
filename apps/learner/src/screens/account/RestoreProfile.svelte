<script lang="ts">
  import { startRestore } from '../../account/restore-flow.js';
  import { appState } from '../../app-state.svelte.js';
  import { t, type Lang } from '../../i18n/index.js';
  import PinPad from '../profiles/PinPad.svelte';
  import CodeEntry from './CodeEntry.svelte';

  let { lang, oncancel }: { lang: Lang; oncancel: () => void } = $props();

  let firstPin = $state('');
  let error = $state('');
  let busy = $state(false);
  /** Google, or a mentor's backup code (spec §5.3); with a code, the hidden profile waits here. */
  let via = $state<'google' | 'code'>('google');
  let waitingForCode = $state<string | null>(null);

  /** A new PIN for this phone, entered twice; then Google sign-in finds the learner. */
  async function submit(pin: string): Promise<void> {
    if (!firstPin) {
      firstPin = pin;
      error = '';
      return;
    }
    if (pin !== firstPin) {
      error = t('create.pinMismatch', lang);
      return;
    }
    const runtime = appState.runtime;
    if (!runtime) return;
    busy = true;
    try {
      const provisional = await startRestore(runtime, pin, via); // Google: the browser leaves
      if (via === 'code') waitingForCode = provisional;
    } catch {
      error = t('account.failed', lang);
      busy = false;
    }
  }
</script>

<section class="restore">
  <h1>{t('account.restore', lang)}</h1>
  {#if waitingForCode}
    <CodeEntry {lang} profileId={waitingForCode} />
  {:else}
    <p class="prompt">{t(firstPin ? 'create.pinConfirm' : 'account.restorePin', lang)}</p>
    <PinPad {lang} {error} disabled={busy} onsubmit={submit} />
    {#if busy && via === 'google'}
      <p class="muted">{t('account.working', lang)}</p>
    {/if}
    {#if !firstPin && via === 'google'}
      <button type="button" class="link" onclick={() => (via = 'code')}>
        {t('account.haveCode', lang)}
      </button>
    {/if}
  {/if}
  <button type="button" class="link" onclick={oncancel}>{t('create.cancel', lang)}</button>
</section>

<style>
  .restore {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px 20px 24px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 26px;
  }

  .prompt {
    margin: 0;
    font-weight: 600;
    text-align: center;
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
    text-align: center;
  }

  .link {
    min-height: 44px;
    border: none;
    background: none;
    color: var(--color-primary);
    font-weight: 600;
  }
</style>

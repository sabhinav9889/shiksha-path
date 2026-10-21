<script lang="ts">
  import { startRestore } from '../../account/restore-flow.js';
  import { appState } from '../../app-state.svelte.js';
  import { t, type Lang } from '../../i18n/index.js';
  import PinPad from '../profiles/PinPad.svelte';

  let { lang, oncancel }: { lang: Lang; oncancel: () => void } = $props();

  let firstPin = $state('');
  let error = $state('');
  let busy = $state(false);

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
      await startRestore(runtime, pin); // the browser now goes to Google and comes back
    } catch {
      error = t('account.failed', lang);
      busy = false;
    }
  }
</script>

<section class="restore">
  <h1>{t('account.restore', lang)}</h1>
  <p class="prompt">{t(firstPin ? 'create.pinConfirm' : 'account.restorePin', lang)}</p>
  <PinPad {lang} {error} disabled={busy} onsubmit={submit} />
  {#if busy}
    <p class="muted">{t('account.working', lang)}</p>
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

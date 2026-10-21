<script lang="ts">
  import { signInWithCode } from '../../account/code-sign-in.js';
  import { announceProfilesChanged } from '../../account/profiles-changed.svelte.js';
  import { finishSignIn } from '../../account/finish-sign-in.js';
  import { appState } from '../../app-state.svelte.js';
  import { t, type Lang, type StringKey } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';

  /** Sign in with a mentor's backup code (spec §5.3), then link or restore like Google does. */
  let { lang, profileId, oncancel }: { lang: Lang; profileId: string; oncancel?: () => void } =
    $props();

  let code = $state('');
  let busy = $state(false);
  let error = $state<StringKey | null>(null);
  let done = $state<StringKey | null>(null);

  const ERRORS: Record<string, StringKey> = {
    BAD_CODE: 'account.badCode',
    RATE_LIMITED: 'account.tooMany',
  };

  /** The picker, with the new or replaced profile in it, whichever screen this was on. */
  function leave(): void {
    announceProfilesChanged();
    navigate({ name: 'profiles' });
  }

  async function submit(): Promise<void> {
    const runtime = appState.runtime;
    if (!runtime || busy || code.trim() === '') return;
    busy = true;
    error = null;
    const typed = code;
    code = ''; // the code leaves the page at once
    const result = await signInWithCode(runtime, profileId, typed);
    if (result === 'ok') done = await finishSignIn(runtime, profileId, 'code');
    else error = ERRORS[result] ?? 'account.failed';
    busy = false;
  }
</script>

<section class="card">
  {#if done}
    <p role="status">{t(done, lang)}</p>
    <button type="button" class="primary" onclick={leave}>
      {t('account.continue', lang)}
    </button>
  {:else}
    <label class="field">
      {t('account.codeLabel', lang)}
      <input
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="12"
        bind:value={code}
      />
    </label>
    {#if error}
      <p class="error" role="alert">{t(error, lang)}</p>
    {/if}
    <button type="button" class="primary" disabled={busy} onclick={submit}>
      {t('account.codeSubmit', lang)}
    </button>
    {#if oncancel}
      <button type="button" class="later" onclick={oncancel}>{t('create.cancel', lang)}</button>
    {/if}
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-m);
    background: var(--color-primary-soft);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
  }

  input {
    min-height: 48px;
    padding: 0 12px;
    border: 1.5px solid var(--color-line);
    border-radius: 12px;
    font-size: 20px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  p {
    margin: 0;
  }

  .error {
    color: var(--color-wrong);
  }

  button {
    min-height: 48px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
  }

  .primary {
    border: none;
    background: var(--color-primary);
    color: #fff;
  }

  .later {
    border: none;
    background: transparent;
    color: var(--color-primary);
  }

  button:disabled {
    opacity: 0.4;
  }
</style>

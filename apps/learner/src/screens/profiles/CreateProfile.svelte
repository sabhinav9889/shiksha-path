<script lang="ts">
  import {
    CoreError,
    createEvent,
    createProfile,
    type LanguagePreference,
    type Profile,
  } from '@shiksha/learner-core';
  import { appState, signIn } from '../../app-state.svelte.js';
  import { errorMessage, t, type Lang } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import { requestPersistence } from '../../runtime/persistence.js';
  import { linkSignedInProfile } from '../../account/link-signed-in.js';
  import LinkCard from '../account/LinkCard.svelte';
  import PinPad from './PinPad.svelte';

  type Step = 'details' | 'pin' | 'confirm' | 'link';

  let {
    lang,
    existingCount,
    oncancel,
  }: { lang: Lang; existingCount: number; oncancel?: (() => void) | undefined } = $props();

  let step = $state<Step>('details');
  let name = $state('');
  let preference = $state<LanguagePreference>('hi_en');
  let firstPin = $state('');
  let error = $state('');
  let busy = $state(false);
  /** Kept so a retry after a half-finished creation reuses it instead of making a second one. */
  let created: Profile | null = null;

  function choosePin(pin: string): void {
    firstPin = pin;
    error = '';
    step = 'confirm';
  }

  async function create(pin: string): Promise<void> {
    const runtime = appState.runtime;
    if (!runtime) return;
    const profile =
      created ??
      (await createProfile(
        { name, pin },
        { store: runtime.profiles, ids: runtime.ids, clock: runtime.clock },
      ));
    created = profile;
    if (existingCount === 0) await requestPersistence();
    await runtime.events.append(createEvent(runtime, profile.id, 'language_changed', { preference }));
    await signIn(profile.id, pin);
    if (runtime.account) step = 'link'; // offer Google straight away, while the learner is here
    else navigate({ name: 'home' });
  }

  async function confirmPin(pin: string): Promise<void> {
    if (pin !== firstPin) {
      error = t('create.pinMismatch', lang);
      return;
    }
    busy = true;
    error = '';
    try {
      await create(pin);
    } catch (failure) {
      if (!(failure instanceof CoreError)) {
        error = t('profiles.generalError', lang);
        return;
      }
      error = errorMessage(failure.code, lang, failure.details);
      step = failure.code === 'NAME_INVALID' ? 'details' : 'pin';
    } finally {
      busy = false;
    }
  }
</script>

<section class="create">
  <h1>{t('create.title', lang)}</h1>

  {#if step === 'details'}
    <label class="field">
      {t('create.name', lang)}
      <input type="text" maxlength="40" autocomplete="off" bind:value={name} />
    </label>
    <fieldset>
      <legend>{t('create.language', lang)}</legend>
      <label class="choice">
        <input type="radio" name="preference" value="hi_en" bind:group={preference} />
        {t('create.langHiEn', lang)}
      </label>
      <label class="choice">
        <input type="radio" name="preference" value="en_only" bind:group={preference} />
        {t('create.langEn', lang)}
      </label>
    </fieldset>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <button class="primary" type="button" disabled={name.trim() === ''} onclick={() => (step = 'pin')}>
      {t('action.next', lang)}
    </button>
  {:else if step === 'link'}
    <LinkCard
      {lang}
      message="account.linkWhy"
      onlink={linkSignedInProfile}
      onlater={() => navigate({ name: 'home' })}
    />
  {:else}
    <p class="prompt">{t(step === 'pin' ? 'create.pinNew' : 'create.pinConfirm', lang)}</p>
    <PinPad
      {lang}
      {error}
      disabled={busy}
      onsubmit={step === 'pin' ? choosePin : confirmPin}
    />
    {#if busy}
      <p class="muted">{t('create.saving', lang)}</p>
    {/if}
  {/if}

  {#if oncancel && step !== 'link'}
    <button class="link" type="button" onclick={oncancel}>{t('create.cancel', lang)}</button>
  {/if}
</section>

<style>
  .create {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px 20px 24px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 28px;
    line-height: 1.15;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
  }

  input[type='text'] {
    min-height: 48px;
    padding: 0 14px;
    border: 2px solid var(--color-line);
    border-radius: var(--radius-m);
    font-family: inherit;
    font-size: 18px;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: none;
    padding: 0;
  }

  legend {
    margin-bottom: 8px;
    font-weight: 600;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  .primary {
    min-height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }

  .primary:disabled {
    opacity: 0.4;
  }

  .prompt {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .error {
    margin: 0;
    color: var(--color-wrong);
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
    text-align: center;
  }

  .link {
    border: none;
    background: none;
    color: var(--color-primary);
    font-weight: 600;
  }
</style>

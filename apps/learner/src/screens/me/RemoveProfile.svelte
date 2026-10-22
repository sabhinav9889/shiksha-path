<script lang="ts">
  import { CoreError, verifyPin } from '@shiksha/learner-core';
  import { wipeProfile } from '../../account/forget.js';
  import { appState, signOut } from '../../app-state.svelte.js';
  import { errorMessage, t, type Lang } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import PinPad from '../profiles/PinPad.svelte';

  /**
   * Remove this profile from this phone only, after its PIN (a shared phone, a sold phone). The
   * server keeps a linked profile's copy, so "bring back my profile" still works.
   */
  let { lang }: { lang: Lang } = $props();

  let asking = $state(false);
  let error = $state('');
  let busy = $state(false);

  async function confirm(pin: string): Promise<void> {
    const { runtime, profile } = appState;
    if (!runtime || !profile || busy) return;
    busy = true;
    error = '';
    try {
      await verifyPin(profile.id, pin, { store: runtime.profiles, clock: runtime.clock });
      await wipeProfile(runtime, profile.id);
      signOut();
      navigate({ name: 'profiles' });
    } catch (failure) {
      error =
        failure instanceof CoreError
          ? errorMessage(failure.code, lang, failure.details)
          : t('account.failed', lang);
    } finally {
      busy = false;
    }
  }
</script>

{#if asking}
  <div class="confirm">
    <p>{t('me.removeConfirm', lang)}</p>
    <PinPad {lang} {error} disabled={busy} onsubmit={confirm} />
    <button type="button" onclick={() => (asking = false)}>{t('create.cancel', lang)}</button>
  </div>
{:else}
  <button type="button" class="danger" onclick={() => (asking = true)}>
    {t('me.remove', lang)}
  </button>
{/if}

<style>
  .confirm {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  p {
    margin: 0;
    font-weight: 600;
  }

  button {
    min-height: 52px;
    border: none;
    border-bottom: 1px solid var(--color-line);
    background: none;
    color: var(--color-ink);
    font-size: 15px;
    text-align: left;
  }

  .danger {
    color: var(--color-wrong);
  }
</style>

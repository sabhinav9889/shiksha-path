<script lang="ts">
  import { onMount } from 'svelte';
  import { linkProfile, type LinkOutcome } from '../../account/link-flow.js';
  import { completeRestore, isRestoring, type RestoreOutcome } from '../../account/restore-flow.js';
  import { appState } from '../../app-state.svelte.js';
  import { t, type StringKey } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';

  let message = $state<StringKey>('account.working');
  let done = $state(false);

  const lang = $derived(appState.lang);

  function linkMessage(outcome: LinkOutcome): StringKey {
    if (outcome.kind === 'linked') return 'account.linked';
    if (outcome.kind === 'adopted') return 'account.adopted';
    return outcome.kind === 'elsewhere' ? 'account.elsewhere' : 'account.failed';
  }

  const restoreMessage = (outcome: RestoreOutcome): StringKey =>
    outcome.kind === 'restored'
      ? 'account.restored'
      : outcome.kind === 'none'
        ? 'account.notFound'
        : 'account.failed';

  /** Google has sent the learner back here: finish signing in, then link or restore. */
  onMount(async () => {
    const runtime = appState.runtime;
    const auth = await runtime?.account?.loadAuth();
    const signedIn = await auth?.finishGoogleSignIn(window.location.href).catch(() => null);
    if (!runtime || !signedIn) {
      navigate({ name: 'profiles' });
      return;
    }
    const { profileId } = signedIn;
    message = (await isRestoring(runtime, profileId))
      ? restoreMessage(await completeRestore(runtime, profileId))
      : linkMessage(await linkProfile(runtime, profileId));
    done = true;
  });
</script>

<section class="callback">
  <p role="status">{t(message, lang)}</p>
  {#if done}
    <button type="button" onclick={() => navigate({ name: 'profiles' })}>
      {t('account.continue', lang)}
    </button>
  {/if}
</section>

<style>
  .callback {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 640px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  p {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    overflow-wrap: anywhere;
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
</style>

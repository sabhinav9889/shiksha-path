<script lang="ts">
  import { onMount } from 'svelte';
  import { finishSignIn } from '../../account/finish-sign-in.js';
  import { appState } from '../../app-state.svelte.js';
  import { t, type StringKey } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';

  let message = $state<StringKey>('account.working');
  let done = $state(false);

  const lang = $derived(appState.lang);

  /** Google has sent the learner back here: finish signing in, then link or restore. */
  onMount(async () => {
    const runtime = appState.runtime;
    const auth = await runtime?.account?.loadAuth().catch(() => null);
    const signedIn = await auth?.finishGoogleSignIn(window.location.href).catch(() => null);
    if (!runtime || !signedIn) {
      navigate({ name: 'profiles' });
      return;
    }
    message = await finishSignIn(runtime, signedIn.profileId);
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

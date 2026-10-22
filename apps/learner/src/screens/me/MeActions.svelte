<script lang="ts">
  import { onMount } from 'svelte';
  import { linkSignedInProfile as link } from '../../account/link-signed-in.js';
  import { signOut } from '../../app-state.svelte.js';
  import { t, type Lang } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import { install } from '../../runtime/install-prompt.js';
  import RemoveProfile from './RemoveProfile.svelte';

  /** The account row and what a learner can do with their profile on this phone. */
  let { lang, linked }: { lang: Lang; linked: boolean | null } = $props();

  let canInstall = $state(install.prompt?.available() ?? false);

  onMount(() =>
    install.prompt?.subscribe(() => (canInstall = install.prompt?.available() ?? false)),
  );

  /** Nobody stays signed in: the picker is the only place left, and Back cannot return. */
  function leave(): void {
    signOut();
    navigate({ name: 'profiles' });
  }
</script>

<section class="card links">
  {#if linked === true}
    <p>{t('account.linkedRow', lang)}</p>
  {:else if linked === false}
    <button type="button" onclick={link}>{t('account.link', lang)}</button>
  {/if}
  {#if canInstall}
    <button type="button" onclick={() => void install.prompt?.prompt()}>
      {t('me.install', lang)}
    </button>
  {/if}
  <button type="button" onclick={leave}>{t('me.switch', lang)}</button>
  <button type="button" class="danger" onclick={leave}>{t('me.signOut', lang)}</button>
  <p>{t('me.signOutNote', lang)}</p>
  <RemoveProfile {lang} />
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
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

  p {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>

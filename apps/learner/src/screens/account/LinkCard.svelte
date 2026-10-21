<script lang="ts">
  import { appState } from '../../app-state.svelte.js';
  import { t, type Lang, type StringKey } from '../../i18n/index.js';
  import CodeEntry from './CodeEntry.svelte';

  interface Props {
    lang: Lang;
    message: StringKey;
    onlink: () => void;
    onlater?: (() => void) | undefined;
  }

  let { lang, message, onlink, onlater }: Props = $props();

  /** A student without Google signs in with the code a mentor gave them (spec §5.3). */
  let withCode = $state(false);
  const profileId = $derived(appState.profile?.id ?? null);
</script>

{#if withCode && profileId}
  <CodeEntry {lang} {profileId} oncancel={() => (withCode = false)} />
{:else}
  <section class="card">
    <p>{t(message, lang)}</p>
    <button type="button" class="primary" onclick={onlink}>{t('account.link', lang)}</button>
    {#if profileId}
      <button type="button" class="later" onclick={() => (withCode = true)}>
        {t('account.haveCode', lang)}
      </button>
    {/if}
    {#if onlater}
      <button type="button" class="later" onclick={onlater}>{t('account.later', lang)}</button>
    {/if}
  </section>
{/if}

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

  p {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
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
    border: 1.5px solid var(--color-line);
    background: var(--color-card);
    color: var(--color-ink);
  }
</style>

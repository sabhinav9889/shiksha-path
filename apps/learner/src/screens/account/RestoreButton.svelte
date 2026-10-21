<script lang="ts">
  import { appState } from '../../app-state.svelte.js';
  import { t, type Lang } from '../../i18n/index.js';

  let { lang, onrestore }: { lang: Lang; onrestore: () => void } = $props();
</script>

{#if appState.runtime?.account}
  <button type="button" onclick={onrestore}>{t('account.restore', lang)}</button>
{/if}

<style>
  button {
    align-self: center;
    min-height: 48px;
    margin: 0 20px 24px;
    padding: 0 16px;
    border: 1.5px solid var(--color-primary);
    border-radius: 14px;
    background: var(--color-card);
    color: var(--color-primary);
    font-weight: 600;
  }
</style>

<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';

  let {
    lang,
    busy,
    error,
    ondownload,
  }: { lang: Lang; busy: boolean; error: string; ondownload: () => void } = $props();
</script>

<section class="card">
  <h2>{t('home.downloadTitle', lang)}</h2>
  <p>{t('home.downloadBody', lang)}</p>
  <button type="button" disabled={busy} onclick={ondownload}>
    {busy ? t('home.downloading', lang) : t('action.download', lang)}
  </button>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
    border-radius: var(--radius-l);
    background: var(--color-card);
  }

  h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 22px;
  }

  p {
    margin: 0;
    color: var(--color-muted);
  }

  button {
    min-height: 48px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.6;
  }

  .error {
    color: var(--color-wrong);
  }
</style>

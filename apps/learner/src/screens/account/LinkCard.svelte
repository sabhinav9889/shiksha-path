<script lang="ts">
  import { t, type Lang, type StringKey } from '../../i18n/index.js';

  interface Props {
    lang: Lang;
    message: StringKey;
    onlink: () => void;
    onlater?: (() => void) | undefined;
  }

  let { lang, message, onlink, onlater }: Props = $props();
</script>

<section class="card">
  <p>{t(message, lang)}</p>
  <button type="button" class="primary" onclick={onlink}>{t('account.link', lang)}</button>
  {#if onlater}
    <button type="button" class="later" onclick={onlater}>{t('account.later', lang)}</button>
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

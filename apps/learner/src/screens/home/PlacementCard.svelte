<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';

  let { lang, onstart }: { lang: Lang; onstart: () => void } = $props();
</script>

<button type="button" class="card" onclick={onstart}>
  <strong>{t('placement.card', lang)}</strong>
  <span>{t('placement.cardBody', lang)}</span>
</button>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-m);
    background: var(--color-primary-soft);
    color: var(--color-ink);
    text-align: left;
  }

  strong {
    font-size: 17px;
  }

  span {
    color: var(--color-muted);
    font-size: 14px;
  }
</style>

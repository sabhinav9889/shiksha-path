<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';
  import { routeHref } from '../../router.svelte.js';

  let { lang }: { lang: Lang } = $props();
</script>

<a class="card" href={routeHref({ name: 'community' })}>
  <strong>{t('home.community', lang)}</strong>
  <span>{t('home.communitySub', lang)}</span>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
    color: var(--color-ink);
    text-decoration: none;
  }

  strong {
    font-size: 16px;
  }

  span {
    color: var(--color-muted);
    font-size: 13px;
  }
</style>

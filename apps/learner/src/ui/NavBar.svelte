<script lang="ts">
  import { t, type Lang } from '../i18n/index.js';
  import { routeHref, type Route } from '../router.svelte.js';
  import Icon from './Icon.svelte';

  let { lang, current }: { lang: Lang; current: Route['name'] } = $props();

  const tabs = [
    { route: { name: 'home' } as Route, icon: 'home', label: 'nav.home' },
    { route: { name: 'lessons' } as Route, icon: 'book', label: 'nav.lessons' },
    { route: { name: 'me' } as Route, icon: 'user', label: 'nav.me' },
  ] as const;
</script>

<nav aria-label={t('nav.label', lang)}>
  {#each tabs as tab (tab.label)}
    <a
      href={routeHref(tab.route)}
      aria-current={current === tab.route.name ? 'page' : undefined}
      class:active={current === tab.route.name}
    >
      <Icon name={tab.icon} />
      {t(tab.label, lang)}
    </a>
  {/each}
</nav>

<style>
  nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    background: var(--color-card);
    border-top: 1px solid var(--color-line);
    padding: 6px 4px 10px;
  }

  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    color: var(--color-muted);
    font-size: 12px;
    text-decoration: none;
  }

  a.active {
    color: var(--color-primary);
    font-weight: 600;
  }
</style>

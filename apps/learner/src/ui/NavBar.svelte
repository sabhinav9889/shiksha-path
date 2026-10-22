<script lang="ts">
  import { appState } from '../app-state.svelte.js';
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
  <span class="brand">{appState.brand.name[lang]}</span>
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

  .brand {
    display: none;
  }

  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    border-radius: 14px;
    color: var(--color-muted);
    font-size: 12px;
    text-decoration: none;
  }

  a.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  @media (min-width: 768px) {
    nav {
      position: sticky;
      top: 0;
      flex-shrink: 0;
      width: 96px;
      height: 100dvh;
      grid-template-columns: none;
      align-content: start;
      gap: 6px;
      padding: 20px 8px;
      border-top: none;
      border-right: 1px solid var(--color-line);
    }

    a {
      min-height: 64px;
      font-size: 13px;
    }

    a.active {
      background: var(--color-primary-soft);
      color: var(--color-primary-dark);
    }
  }

  @media (min-width: 1024px) {
    nav {
      width: 220px;
      padding: 22px 14px;
    }

    .brand {
      display: block;
      padding: 0 12px 16px;
      color: var(--color-primary);
      font-family: var(--font-heading);
      font-size: 24px;
      font-weight: 700;
    }

    a {
      flex-direction: row;
      justify-content: flex-start;
      gap: 10px;
      min-height: 48px;
      padding: 0 14px;
      font-size: 16px;
    }
  }
</style>

<script lang="ts">
  import { appState } from '../app-state.svelte.js';
  import { t, type Lang, type StringKey } from '../i18n/index.js';
  import { routeHref, type Route } from '../router.svelte.js';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons.js';

  let { lang, current }: { lang: Lang; current: Route['name'] } = $props();

  type Tab = { route: Route; icon: IconName; label: StringKey; on: boolean };
  const all = $derived<Tab[]>([
      { route: { name: 'home' }, icon: 'home', label: 'nav.home', on: true },
      { route: { name: 'lessons' }, icon: 'book', label: 'nav.lessons', on: true },
      {
        route: { name: 'community' },
        icon: 'people',
        label: 'nav.community',
        on: appState.switches.community_feed,
      },
      { route: { name: 'me' }, icon: 'user', label: 'nav.me', on: true },
  ]);
  const tabs = $derived(all.filter((tab) => tab.on));
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
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
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
      grid-auto-flow: row;
      grid-auto-columns: auto;
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

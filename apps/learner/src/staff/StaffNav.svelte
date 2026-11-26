<script lang="ts">
  import type { StaffMe } from '@shiksha/api-contract/staff';
  import type { Lang } from '../i18n/index.js';
  import { routeHref, router, type Route } from '../router.svelte.js';
  import { pageLabel } from './page-label.js';
  import { st, type StaffKey } from './i18n.js';
  import StaffLangToggle from './StaffLangToggle.svelte';

  let { me, lang, onsignout }: { me: StaffMe; lang: Lang; onsignout: () => void } = $props();

  const here = $derived(pageLabel(router.current, me.role));
  const openCohort = $derived(
    router.current.name === 'staff' && router.current.view === 'cohort' ? router.current.id : null,
  );
  const openName = $derived(me.cohorts.find((c) => c.id === openCohort)?.name);
  let menuOpen = $state(false);

  const links = $derived<{ route: Route; label: StaffKey }[]>([
    { route: { name: 'staff', view: 'cohorts' }, label: 'cohorts' },
    { route: { name: 'staff', view: 'recordings' }, label: 'recordings' },
    { route: { name: 'staff', view: 'posts' }, label: 'posts' },
    { route: { name: 'staff', view: 'slots' }, label: 'slots' },
    ...(me.role === 'admin'
      ? ([
          { route: { name: 'staff', view: 'admin', section: 'setup' }, label: 'adminSetup' },
          { route: { name: 'staff', view: 'admin', section: 'students' }, label: 'adminStudents' },
          { route: { name: 'staff', view: 'admin', section: 'switches' }, label: 'adminSwitches' },
          { route: { name: 'staff', view: 'admin', section: 'branding' }, label: 'adminBranding' },
          { route: { name: 'staff', view: 'admin', section: 'audit' }, label: 'adminAudit' },
        ] as const)
      : []),
  ]);
</script>

<svelte:window
  onclick={(e) => {
    if (!(e.target as Element).closest('.cohort-menu')) menuOpen = false;
  }}
  onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
/>

<nav class="staff-nav" aria-label={st('cohorts', lang)}>
  <div class="top">
    <div class="who">
      <strong>{me.name}</strong>
      <span>{st(me.role, lang)}</span>
    </div>
    <StaffLangToggle />
    <button type="button" onclick={onsignout}>{st('signOut', lang)}</button>
  </div>
  <div class="menu">
    <div class="links">
      {#each links as link (link.label)}
        <a
          href={routeHref(link.route)}
          aria-current={link.label === here && !openCohort ? 'page' : undefined}
          class:here={link.label === here && !openCohort}>{st(link.label, lang)}</a
        >
      {/each}
    </div>
    {#if me.cohorts.length > 0}
      <div class="cohort-menu">
        <button
          type="button"
          class="trigger"
          class:here={openCohort !== null}
          aria-current={openCohort ? 'page' : undefined}
          aria-expanded={menuOpen}
          aria-controls="cohort-list"
          onclick={() => (menuOpen = !menuOpen)}
        >
          {openName ?? st('myCohorts', lang)}
          <span class="count">{me.cohorts.length}</span>
          <span aria-hidden="true">{menuOpen ? '▴' : '▾'}</span>
        </button>
        <ul id="cohort-list" class="cohorts" hidden={!menuOpen}>
          {#each me.cohorts as cohort (cohort.id)}
            <li>
              <a
                href={routeHref({ name: 'staff', view: 'cohort', id: cohort.id })}
                aria-current={cohort.id === openCohort ? 'page' : undefined}
                class:here={cohort.id === openCohort}
                onclick={() => (menuOpen = false)}>{cohort.name}</a
              >
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</nav>

<style>
  .staff-nav {
    border-bottom: 1px solid var(--color-line);
    background: var(--color-card);
  }

  .top {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px 8px;
  }

  .who {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }

  .who strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .who span {
    color: var(--color-muted);
    font-size: 13px;
  }

  .menu {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 0 16px 10px;
  }

  /* One row that scrolls sideways on a narrow screen, so the bar never grows taller. */
  .links {
    display: flex;
    flex: 1;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .links::-webkit-scrollbar {
    display: none;
  }

  a,
  button {
    display: inline-flex;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  a.here {
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
    box-shadow: inset 0 -3px 0 var(--color-primary);
  }

  button {
    border: 1.5px solid var(--color-line);
    background: none;
  }

  .cohort-menu {
    position: relative;
    flex-shrink: 0;
  }

  .trigger.here {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
  }

  .count {
    min-width: 22px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
    font-size: 13px;
    text-align: center;
  }

  .cohorts {
    position: absolute;
    z-index: 10;
    top: calc(100% + 6px);
    right: 0;
    min-width: 220px;
    max-width: min(320px, 90vw);
    max-height: 60vh;
    margin: 0;
    padding: 6px;
    overflow-y: auto;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-s);
    background: var(--color-card);
    box-shadow: 0 8px 24px rgb(27 31 59 / 15%);
    list-style: none;
  }

  .cohorts[hidden] {
    display: none;
  }

  .cohorts a {
    display: flex;
    width: 100%;
    white-space: normal;
  }
</style>

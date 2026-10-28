<script lang="ts">
  import type { StaffMe } from '@shiksha/api-contract/staff';
  import type { Lang } from '../i18n/index.js';
  import { routeHref, router, type Route } from '../router.svelte.js';
  import { pageLabel } from './page-label.js';
  import { st, type StaffKey } from './i18n.js';
  import StaffLangToggle from './StaffLangToggle.svelte';

  let { me, lang, onsignout }: { me: StaffMe; lang: Lang; onsignout: () => void } = $props();

  const here = $derived(pageLabel(router.current, me.role));
  const openCohort = $derived(router.current.name === 'staff' && router.current.view === 'cohort' ? router.current.id : null);

  const links = $derived<{ route: Route; label: StaffKey }[]>([
    { route: { name: 'staff', view: 'cohorts' }, label: 'cohorts' },
    { route: { name: 'staff', view: 'recordings' }, label: 'recordings' },
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

<nav class="staff-nav" aria-label={st('cohorts', lang)}>
  <div class="who">
    <strong>{me.name}</strong>
    <span>{st(me.role, lang)}</span>
  </div>
  <ul class="cohorts">
    {#each me.cohorts as cohort (cohort.id)}
      <li>
        <a
          href={routeHref({ name: 'staff', view: 'cohort', id: cohort.id })}
          aria-current={cohort.id === openCohort ? 'page' : undefined}
          class:here={cohort.id === openCohort}>{cohort.name}</a
        >
      </li>
    {/each}
  </ul>
  <div class="links">
    {#each links as link (link.label)}
      <a
        href={routeHref(link.route)}
        aria-current={link.label === here && !openCohort ? 'page' : undefined}
        class:here={link.label === here && !openCohort}>{st(link.label, lang)}</a
      >
    {/each}
  </div>
  <StaffLangToggle />
  <button type="button" onclick={onsignout}>{st('signOut', lang)}</button>
</nav>

<style>
  .staff-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-card);
  }

  .who {
    display: flex;
    flex-direction: column;
  }

  .who span {
    color: var(--color-muted);
    font-size: 13px;
  }

  .cohorts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-muted);
    font-size: 13px;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  a,
  button {
    display: inline-flex;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: none;
  }

  a.here {
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
    box-shadow: inset 0 -3px 0 var(--color-primary);
  }

  button {
    margin-left: auto;
    border: 1.5px solid var(--color-line);
    background: none;
  }
</style>

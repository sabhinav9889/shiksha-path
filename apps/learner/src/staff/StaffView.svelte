<script lang="ts">
  import type { Lang } from '../i18n/index.js';
  import type { Route } from '../router.svelte.js';
  import Audit from './screens/admin/Audit.svelte';
  import Branding from './screens/admin/Branding.svelte';
  import Setup from './screens/admin/Setup.svelte';
  import Students from './screens/admin/Students.svelte';
  import Switches from './screens/admin/Switches.svelte';
  import Cohorts from './screens/Cohorts.svelte';
  import Recordings from './screens/Recordings.svelte';
  import Student from './screens/Student.svelte';
  import { staffState } from './staff-state.svelte.js';

  /** Which staff screen to show. Admin screens only for admins; the server checks again. */
  let { route, lang }: { route: Extract<Route, { name: 'staff' }>; lang: Lang } = $props();
  const admin = {
    setup: Setup,
    students: Students,
    switches: Switches,
    branding: Branding,
    audit: Audit,
  };
</script>

<div class="view" data-view={route.view}>
  {#if route.view === 'cohorts'}
    <Cohorts {lang} />
  {:else if route.view === 'student'}
    {#key route.id}<Student id={route.id} {lang} />{/key}
  {:else if route.view === 'recordings'}
    <Recordings {lang} />
  {:else if route.view === 'admin' && staffState.me?.role === 'admin'}
    {#key route.section}
      {@const Section = admin[route.section]}
      <Section {lang} />
    {/key}
  {:else}
    <Cohorts {lang} />
  {/if}
</div>

<style>
  .view {
    max-width: 1024px;
    margin: 0 auto;
    padding: 16px;
  }
</style>

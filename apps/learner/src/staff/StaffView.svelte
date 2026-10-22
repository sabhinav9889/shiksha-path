<script lang="ts">
  import type { Lang } from '../i18n/index.js';
  import type { Route } from '../router.svelte.js';
  import { st } from './i18n.js';
  import Cohorts from './screens/Cohorts.svelte';
  import Recordings from './screens/Recordings.svelte';
  import Student from './screens/Student.svelte';

  /** Which staff screen to show; the admin screens arrive in Task 12. */
  let { route, lang }: { route: Extract<Route, { name: 'staff' }>; lang: Lang } = $props();
</script>

<div class="view" data-view={route.view}>
  {#if route.view === 'cohorts'}
    <Cohorts {lang} />
  {:else if route.view === 'student'}
    {#key route.id}<Student id={route.id} {lang} />{/key}
  {:else if route.view === 'recordings'}
    <Recordings {lang} />
  {:else}
    <p>{st('loading', lang)}</p>
  {/if}
</div>

<style>
  .view {
    max-width: 1024px;
    margin: 0 auto;
    padding: 16px;
  }
</style>

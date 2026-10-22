<script lang="ts">
  import type { Lang } from '../i18n/index.js';
  import type { Route } from '../router.svelte.js';
  import { st } from './i18n.js';

  /** Which staff screen to show; the screens arrive in Tasks 10–12. */
  let { route, lang }: { route: Extract<Route, { name: 'staff' }>; lang: Lang } = $props();
</script>

<div class="view" data-view={route.view}>
  <p>{st('loading', lang)}</p>
</div>

<style>
  .view {
    max-width: 1024px;
    margin: 0 auto;
    padding: 16px;
  }
</style>

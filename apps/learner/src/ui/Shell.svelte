<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Lang } from '../i18n/index.js';
  import type { Route } from '../router.svelte.js';
  import NavBar from './NavBar.svelte';

  let {
    children,
    lang,
    current,
    showNav,
  }: { children: Snippet; lang: Lang; current: Route['name']; showNav: boolean } = $props();
</script>

<div class="frame">
  <div class="screen">{@render children()}</div>
  {#if showNav}
    <NavBar {lang} {current} />
  {/if}
</div>

<style>
  .frame {
    display: flex;
    flex-direction: column;
    max-width: 480px;
    min-height: 100dvh;
    margin: 0 auto;
    background: var(--color-bg);
  }

  .screen {
    flex-grow: 1;
    min-width: 0;
  }
</style>

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
    min-height: 100dvh;
    background: var(--color-bg);
  }

  .screen {
    flex-grow: 1;
    width: 100%;
    min-width: 0;
    max-width: 1100px;
    margin: 0 auto;
  }

  @media (min-width: 768px) {
    .frame {
      flex-direction: row;
    }

    .frame > :global(nav) {
      order: -1; /* the navigation comes first, on the left */
    }
  }
</style>

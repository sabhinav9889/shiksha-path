<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from './app-state.svelte.js';
  import { navigate, router, startRouter, type Route } from './router.svelte.js';
  import HomeScreen from './screens/home/HomeScreen.svelte';
  import ProfilesScreen from './screens/profiles/ProfilesScreen.svelte';
  import Shell from './ui/Shell.svelte';

  /** Without a signed-in profile the only place to be is the profile picker. */
  const route: Route = $derived(
    appState.profile || router.current.name === 'profiles' ? router.current : { name: 'profiles' },
  );

  $effect(() => {
    if (route !== router.current) navigate(route);
  });

  onMount(startRouter);

  const showNav = $derived(
    appState.profile !== null && (route.name === 'home' || route.name === 'lessons'),
  );
</script>

<div data-testid="app-root">
  <Shell lang={appState.lang} current={route.name} {showNav}>
    {#if route.name === 'profiles'}
      <ProfilesScreen />
    {:else if route.name === 'home'}
      <HomeScreen />
    {:else}
      <div data-testid={`screen-${route.name}`}></div>
    {/if}
  </Shell>
</div>

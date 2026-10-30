<script lang="ts">
  import { onMount } from 'svelte';
  import { activity, resetActivity } from './activity.svelte.js';
  import { appState } from './app-state.svelte.js';
  import { applyBranding } from './runtime/branding.js';
  import { navigate, router, startRouter, type Route } from './router.svelte.js';
  import FinishScreen from './screens/finish/FinishScreen.svelte';
  import HomeScreen from './screens/home/HomeScreen.svelte';
  import LearnScreen from './screens/learn/LearnScreen.svelte';
  import LessonsScreen from './screens/lessons/LessonsScreen.svelte';
  import AuthCallback from './screens/account/AuthCallback.svelte';
  import MeScreen from './screens/me/MeScreen.svelte';
  import PlacementResult from './screens/placement/PlacementResult.svelte';
  import PlacementScreen from './screens/placement/PlacementScreen.svelte';
  import PracticeScreen from './screens/practice/PracticeScreen.svelte';
  import ProfilesScreen from './screens/profiles/ProfilesScreen.svelte';
  import Shell from './ui/Shell.svelte';

  /** Places a signed-out phone may be: the picker, Google's return page, and the staff section. */
  const OPEN_ROUTES: Route['name'][] = ['profiles', 'auth-callback', 'staff'];

  /** Without a signed-in profile the only place to be is the profile picker. */
  const route: Route = $derived(
    appState.profile || OPEN_ROUTES.includes(router.current.name)
      ? router.current
      : { name: 'profiles' },
  );

  $effect(() => {
    if (route !== router.current) navigate(route);
  });

  /** The NGO's name and colours, from the phone's copy; they follow every sync. */
  $effect(() => applyBranding(appState.brand, document, appState.lang));

  /** Browser Back, a nav tab or a reload away from a run ends it, so no stale run lingers. */
  const RUN_SCREENS: Route['name'][] = [
    'learn',
    'practice',
    'finish',
    'placement',
    'placement-result',
  ];
  $effect(() => {
    if (activity.current && !RUN_SCREENS.includes(route.name)) resetActivity();
  });

  onMount(startRouter);

  const showNav = $derived(
    appState.profile !== null && ['home', 'lessons', 'me', 'community', 'mentors'].includes(route.name),
  );
</script>

<div data-testid="app-root">
  <Shell lang={appState.lang} current={route.name} {showNav}>
    {#if route.name === 'profiles'}
      <ProfilesScreen />
    {:else if route.name === 'home'}
      <HomeScreen />
    {:else if route.name === 'lessons'}
      <LessonsScreen />
    {:else if route.name === 'learn'}
      <LearnScreen />
    {:else if route.name === 'practice'}
      <PracticeScreen />
    {:else if route.name === 'finish'}
      <FinishScreen />
    {:else if route.name === 'placement'}
      <PlacementScreen />
    {:else if route.name === 'placement-result'}
      <PlacementResult />
    {:else if route.name === 'me'}
      <MeScreen />
    {:else if route.name === 'community'}
      <!-- A lazy chunk: the first load stays inside its size budget. -->
      {#await import('./community/CommunityScreen.svelte') then community}
        <community.default />
      {/await}
    {:else if route.name === 'mentors'}
      {#await import('./booking/MentorsScreen.svelte') then mentors}
        <mentors.default />
      {/await}
    {:else if route.name === 'auth-callback'}
      <AuthCallback />
    {:else if route.name === 'staff'}
      <!-- The staff section is a separate chunk: a student's first visit never loads it. -->
      {#await import('./staff/StaffApp.svelte') then staff}
        <staff.default />
      {/await}
    {/if}
  </Shell>
</div>

<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from '../app-state.svelte.js';
  import { router } from '../router.svelte.js';
  import { st, type StaffKey } from './i18n.js';
  import { staffState } from './staff-state.svelte.js';
  import StaffNav from './StaffNav.svelte';
  import StaffView from './StaffView.svelte';

  /** The staff section (spec §8): its own Google session, never a learner profile's. */
  const lang = $derived(appState.lang);
  let busy = $state(true);
  let problem = $state<StaffKey | null>(null);

  async function enter(): Promise<void> {
    const auth = staffState.auth;
    if (!auth || !(await auth.token())) {
      staffState.me = null;
      return;
    }
    const claimed = await auth.api.claim();
    if (claimed.ok) {
      staffState.me = claimed.value;
      return;
    }
    problem = claimed.error === 'NOT_STAFF' || claimed.error === 'FORBIDDEN' ? 'notStaff' : 'failed';
    if (problem === 'notStaff') await auth.signOut();
  }

  onMount(async () => {
    try {
      staffState.auth = (await appState.runtime?.account?.loadStaffAuth()) ?? null;
      await staffState.auth?.finish(window.location.href);
      await enter();
    } catch {
      problem = 'failed';
    } finally {
      busy = false;
    }
  });

  async function signIn(): Promise<void> {
    problem = null;
    busy = true;
    try {
      await staffState.auth?.startSignIn(); // in the app the browser now goes to Google
      await enter();
    } catch {
      problem = 'failed';
    } finally {
      busy = false;
    }
  }

  async function signOut(): Promise<void> {
    await staffState.auth?.signOut();
    staffState.me = null;
  }
</script>

<section class="staff">
  {#if staffState.me}
    <StaffNav me={staffState.me} {lang} onsignout={signOut} />
    {#if router.current.name === 'staff'}
      <StaffView route={router.current} {lang} />
    {/if}
  {:else}
    <div class="signin">
      <p>{st('signInWhy', lang)}</p>
      {#if problem}
        <p class="problem" role="alert">{st(problem, lang)}</p>
      {/if}
      {#if busy}
        <p>{st('loading', lang)}</p>
      {:else}
        <button type="button" onclick={signIn}>{st('signIn', lang)}</button>
      {/if}
      <a href="#/profiles">{st('backToApp', lang)}</a>
    </div>
  {/if}
</section>

<style>
  .staff {
    min-height: 100vh;
    background: var(--color-bg);
  }

  .signin {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 480px;
    margin: 0 auto;
    padding: 40px 16px;
  }

  .problem {
    color: var(--color-wrong);
    font-weight: 600;
  }

  button {
    min-height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--color-primary);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
  }

  a {
    color: var(--color-primary);
  }
</style>

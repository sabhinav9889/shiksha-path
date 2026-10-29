<script lang="ts">
  import type { AdminSetup } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../../i18n/index.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';
  import SetupGroups from './SetupGroups.svelte';
  import SetupStaff from './SetupStaff.svelte';
  import './setup.css';

  /** Labs, cohorts and staff invites (spec §8.1 setup). */
  let { lang }: { lang: Lang } = $props();
  let setup = $state<AdminSetup | null>(null);
  let failed = $state(false);

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.setup();
    if (result?.ok) setup = result.value;
    else failed = true;
  }

  onMount(load);
</script>

<div class="admin setup">
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
  {#if !setup}
    <p>{st('loading', lang)}</p>
  {:else}
    <SetupGroups {setup} {lang} reload={load} />
    <SetupStaff {setup} {lang} reload={load} />
  {/if}
</div>

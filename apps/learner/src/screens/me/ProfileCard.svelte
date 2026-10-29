<script lang="ts">
  import type { ProfileResponse } from '@shiksha/api-contract';
  import { onMount } from 'svelte';
  import { linkedApi } from '../../account/account.js';
  import { appState } from '../../app-state.svelte.js';
  import { pc } from './profile-card-i18n.js';
  import { loadProfileCache, refreshProfile, type ProfileStatus } from './profile-cache.js';

  /** The student's own email, cohort and mentors: the copy on the phone, then refreshed. */
  let card = $state<ProfileResponse | null>(null);
  let status = $state<ProfileStatus>('offline');
  const lang = $derived(appState.lang);

  onMount(async () => {
    const { runtime, profile } = appState;
    if (!runtime || !profile) return;
    card = await loadProfileCache(runtime, profile.id);
    const fresh = await refreshProfile(runtime, await linkedApi(runtime, profile.id), profile.id);
    if (appState.profile?.id !== profile.id) return; // the student changed while it loaded
    card = fresh.card;
    status = fresh.status;
  });
</script>

{#if card}
  <section class="card">
    <h2>{pc('title', lang)}</h2>
    <dl>
      {#if card.email}
        <dt>{pc('email', lang)}</dt>
        <dd>{card.email}</dd>
      {/if}
      <dt>{pc('cohort', lang)}</dt>
      <dd>{card.cohort?.name ?? pc('noCohort', lang)}</dd>
      <dt>{pc('mentors', lang)}</dt>
      {#each card.mentors as mentor (mentor.email)}
        <dd><strong>{mentor.name}</strong> <span class="muted">{mentor.email}</span></dd>
      {:else}
        <dd>{pc('noMentors', lang)}</dd>
      {/each}
    </dl>
    {#if status === 'offline'}<p class="muted">{pc('offline', lang)}</p>{/if}
  </section>
{/if}

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  h2 {
    margin: 0;
    font-size: 16px;
  }

  dl {
    display: grid;
    gap: 2px 12px;
    margin: 0;
  }

  dt {
    color: var(--color-muted);
    font-size: 13px;
  }

  dd {
    margin: 0 0 6px;
    overflow-wrap: anywhere;
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>

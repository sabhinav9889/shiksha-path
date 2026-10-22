<script lang="ts">
  import type { StaffCohorts } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import { whenWords } from '../words.js';
  import Attendance from './Attendance.svelte';
  import AttentionBadge from './AttentionBadge.svelte';
  import NewStudent from './NewStudent.svelte';

  /** The mentor's cohorts; the server puts students needing attention first. */
  let { lang }: { lang: Lang } = $props();
  let data = $state<StaffCohorts | null>(null);
  let failed = $state(false);
  let marking = $state<string | null>(null);

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.cohorts();
    if (result?.ok) data = result.value;
    else failed = true;
  }

  onMount(load);
</script>

{#if failed}
  <p role="alert">{st('failed', lang)}</p>
{:else if !data}
  <p>{st('loading', lang)}</p>
{:else}
  {#each data.cohorts as cohort (cohort.id)}
    <section>
      <h2>{cohort.name}</h2>
      {#if cohort.students.length === 0}
        <p>{st('noStudents', lang)}</p>
      {:else if marking === cohort.id}
        <Attendance cohortId={cohort.id} students={cohort.students} {lang} />
      {:else}
        <button type="button" onclick={() => (marking = cohort.id)}>
          {st('markAttendance', lang)}
        </button>
      {/if}
      <ul>
        {#each cohort.students as s (s.id)}
          <li data-testid="student-row">
            <a href={`#/staff/student/${s.id}`}>{s.name}</a>
            {#if s.deactivated}<span class="muted">{st('deactivatedBadge', lang)}</span>{/if}
            <AttentionBadge flags={s.attention} {lang} />
            <span class="muted">
              {st('thisWeek', lang, { n: s.summary?.lessonsThisWeek ?? 0 })} ·
              {st('lastSync', lang, { when: whenWords(s.lastSyncedAt, lang) })}
            </span>
          </li>
        {/each}
      </ul>
      <NewStudent cohortId={cohort.id} {lang} onadded={load} />
    </section>
  {/each}
{/if}

<style>
  ul {
    list-style: none;
    padding: 0;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-line);
  }

  a {
    display: inline-flex;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
    color: var(--color-primary);
    font-weight: 600;
  }

  button {
    min-height: 44px;
    padding: 0 16px;
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }

  .muted {
    color: var(--color-muted);
    font-size: 14px;
  }
</style>

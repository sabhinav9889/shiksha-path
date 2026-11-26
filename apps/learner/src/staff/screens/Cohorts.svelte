<script lang="ts">
  import type { StaffCohorts } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../i18n/index.js';
  import { navigate, routeHref } from '../../router.svelte.js';
  import { at } from '../admin-i18n.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import { whenWords } from '../words.js';
  import Attendance from './Attendance.svelte';
  import AttentionBadge from './AttentionBadge.svelte';
  import NewStudent from './NewStudent.svelte';

  /** The mentor's cohorts; the server puts students needing attention first. */
  let { lang, only }: { lang: Lang; only?: string } = $props();
  let data = $state<StaffCohorts | null>(null);
  let failed = $state(false);
  let marking = $state<string | null>(null);
  /** The lab picked in the filter bar ('' = every lab); a cohort page starts on its own lab. */
  let pickedLab = $state<string | null>(null);

  const all = $derived(data?.cohorts ?? []);
  const lab = $derived(
    pickedLab ?? all.find((c) => c.id === only)?.labId ?? '',
  );
  const choices = $derived(all.filter((c) => !lab || c.labId === lab));
  const shown = $derived(only ? all.filter((c) => c.id === only) : choices);

  function pickLab(id: string): void {
    pickedLab = id;
    const open = all.find((c) => c.id === only);
    if (open && id && open.labId !== id) navigate({ name: 'staff', view: 'cohorts' });
  }

  function pickCohort(id: string): void {
    navigate(id ? { name: 'staff', view: 'cohort', id } : { name: 'staff', view: 'cohorts' });
  }

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
  {#if all.length > 0}
    <div class="filters">
      {#if (data?.labs.length ?? 0) > 0}
        <label>
          {at('lab', lang)}
          <select value={lab} onchange={(e) => pickLab(e.currentTarget.value)}>
            <option value="">{at('allLabs', lang)}</option>
            {#each data?.labs ?? [] as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
          </select>
        </label>
      {/if}
      <label>
        {at('cohort', lang)}
        <select value={only ?? ''} onchange={(e) => pickCohort(e.currentTarget.value)}>
          <option value="">{at('allCohorts', lang)}</option>
          {#each choices as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
        </select>
      </label>
    </div>
  {/if}
  {#if only}
    <a class="all" href={routeHref({ name: 'staff', view: 'cohorts' })}>{at('allCohorts', lang)}</a>
    {#if shown.length === 0}<p>{st('noSuchCohort', lang)}</p>{/if}
  {/if}
  {#each shown as cohort (cohort.id)}
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
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    padding: 14px 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  .filters label {
    display: flex;
    flex: 1 1 200px;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
  }

  .filters select {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-s);
    background: var(--color-card);
    font: inherit;
  }

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

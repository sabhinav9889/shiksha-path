<script lang="ts">
  import type { AdminSetup, StudentsPage } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';
  import { whenWords } from '../../words.js';
  import AttentionBadge from '../AttentionBadge.svelte';
  import StudentActions from './StudentActions.svelte';

  type Row = StudentsPage['students'][number];

  /** Every student: search, filter, 50 at a time; tap a name for the admin actions. */
  let { lang }: { lang: Lang } = $props();
  let cohorts = $state<AdminSetup['cohorts']>([]);
  let rows = $state<Row[] | null>(null);
  let next = $state<string | null>(null);
  let failed = $state(false);
  let selected = $state<string | null>(null);
  const filter = $state({ q: '', cohortId: '', attention: false });

  const cohortName = (id: string | null): string => cohorts.find((c) => c.id === id)?.name ?? '';

  async function load(after?: string): Promise<void> {
    failed = false;
    const result = await staffState.auth?.api.students({
      q: filter.q.trim() || undefined,
      cohortId: filter.cohortId || undefined,
      attention: filter.attention || undefined,
      after,
    });
    if (!result?.ok) {
      failed = true;
      return;
    }
    rows = after ? [...(rows ?? []), ...result.value.students] : result.value.students;
    next = result.value.next;
  }

  async function search(event: Event): Promise<void> {
    event.preventDefault();
    await load();
  }

  onMount(async () => {
    const setup = await staffState.auth?.api.setup();
    if (setup?.ok) cohorts = setup.value.cohorts;
    await load();
  });
</script>

<div class="admin">
  <form onsubmit={search}>
    <label>{at('search', lang)} <input maxlength="80" bind:value={filter.q} /></label>
    <label>
      {at('cohort', lang)}
      <select bind:value={filter.cohortId}>
        <option value="">{at('allCohorts', lang)}</option>
        {#each cohorts as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={filter.attention} />
      {at('needsAttention', lang)}
    </label>
    <button type="submit">{at('find', lang)}</button>
  </form>

  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
  {#if !rows}
    <p>{st('loading', lang)}</p>
  {:else if rows.length === 0}
    <p>{at('none', lang)}</p>
  {:else}
    <ul>
      {#each rows as s (s.id)}
        <li data-testid="admin-student-row">
          <div class="row">
            <button type="button" onclick={() => (selected = selected === s.id ? null : s.id)}>
              {s.name}
            </button>
            <span class="muted">{cohortName(s.cohortId)}</span>
            {#if s.deactivated}<span class="muted">· {st('deactivatedBadge', lang)}</span>{/if}
            <AttentionBadge flags={s.attention} {lang} />
            <span class="muted">{st('lastSync', lang, { when: whenWords(s.lastSyncedAt, lang) })}</span>
          </div>
          {#if selected === s.id}
            <StudentActions student={s} {cohorts} {lang} onchanged={() => load()} />
          {/if}
        </li>
      {/each}
    </ul>
    {#if next}
      <button type="button" onclick={() => load(next ?? undefined)}>{at('more', lang)}</button>
    {/if}
  {/if}
</div>

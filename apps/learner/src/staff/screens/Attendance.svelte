<script lang="ts">
  import { istDay } from '@shiksha/learner-core';
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';

  /** Today's attendance (India time) for one cohort: tick who came, everyone else is absent. */
  let {
    cohortId,
    students,
    lang,
  }: { cohortId: string; students: { id: string; name: string }[]; lang: Lang } = $props();
  const today = istDay(new Date());
  const present = $state<Record<string, boolean>>({});
  let saved = $state(false);
  let failed = $state(false);

  async function save(): Promise<void> {
    saved = false;
    failed = false;
    const ids = students.filter((s) => present[s.id]).map((s) => s.id);
    const result = await staffState.auth?.api.attendance({ cohortId, day: today, present: ids });
    if (result?.ok) saved = true;
    else failed = true;
  }
</script>

<div class="attendance">
  <p class="muted">{today}</p>
  {#each students as s (s.id)}
    <label><input type="checkbox" bind:checked={present[s.id]} /> {s.name}</label>
  {/each}
  <button type="button" onclick={save}>{st('saveAttendance', lang)}</button>
  {#if saved}<p>{st('saved', lang)}</p>{/if}
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
</div>

<style>
  .attendance {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: var(--color-card);
  }

  label {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 40px;
  }

  button {
    min-height: 44px;
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }

  .muted {
    color: var(--color-muted);
  }
</style>

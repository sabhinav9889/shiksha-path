<script lang="ts">
  import { FEATURE_KEYS, type FeatureKey } from '@shiksha/api-contract';
  import type { AdminSetup, StudentsPage } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../../i18n/index.js';
  import { at, FEATURE_NAMES } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import type { StaffApi } from '../../staff-api.js';
  import { staffState } from '../../staff-state.svelte.js';

  type Choice = '' | 'on' | 'off';

  /** Move, pause, per-student feature overrides and delete (asked twice, then the name typed). */
  let {
    student,
    cohorts,
    lang,
    onchanged,
  }: {
    student: StudentsPage['students'][number];
    cohorts: AdminSetup['cohorts'];
    lang: Lang;
    onchanged: () => Promise<void>;
  } = $props();
  let moveTo = $state('');
  let pausing = $state(false);
  let deleteStep = $state<0 | 1 | 2>(0);
  let typed = $state('');
  let overrides = $state<Partial<Record<FeatureKey, Choice>>>({});
  let failed = $state(false);

  async function run(work: (api: StaffApi) => Promise<{ ok: boolean }>): Promise<void> {
    const api = staffState.auth?.api;
    const ok = api ? (await work(api)).ok : false;
    failed = !ok;
    if (ok) await onchanged();
  }

  const move = (): Promise<void> =>
    run((api) => api.editStudent({ learnerId: student.id, cohortId: moveTo || null }));

  async function setActive(active: boolean): Promise<void> {
    pausing = false;
    await run((api) => api.setActive({ learnerId: student.id, active }));
  }

  async function setOverride(key: FeatureKey, choice: Choice): Promise<void> {
    const enabled = choice === '' ? null : choice === 'on';
    await run((api) => api.setOverride({ learnerId: student.id, key, enabled }));
  }

  onMount(async () => {
    moveTo = student.cohortId ?? '';
    const detail = await staffState.auth?.api.student(student.id);
    if (!detail?.ok) return;
    const own = detail.value.overrides;
    overrides = Object.fromEntries(
      FEATURE_KEYS.map((key) => [key, own[key] === undefined ? '' : own[key] ? 'on' : 'off']),
    );
  });
</script>

<div class="actions" data-testid="student-actions">
  <div class="row">
    <label>
      {at('moveTo', lang)}
      <select bind:value={moveTo}>
        {#each cohorts as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
      </select>
    </label>
    <button type="button" onclick={move}>{at('move', lang)}</button>
  </div>

  <div class="row">
    {#if student.deactivated}
      <button type="button" onclick={() => setActive(true)}>{at('reactivate', lang)}</button>
    {:else if pausing}
      <p>{at('confirmDeactivate', lang)}</p>
      <button type="button" onclick={() => setActive(false)}>{at('yesDeactivate', lang)}</button>
      <button type="button" onclick={() => (pausing = false)}>{st('cancel', lang)}</button>
    {:else}
      <button type="button" onclick={() => (pausing = true)}>{at('deactivate', lang)}</button>
    {/if}
  </div>

  <div class="row">
    {#each FEATURE_KEYS as key (key)}
      <label>
        {FEATURE_NAMES[key][lang]}
        <select
          value={overrides[key] ?? ''}
          onchange={(e) => setOverride(key, e.currentTarget.value as Choice)}
        >
          <option value="">{at('sameAsAll', lang)}</option>
          <option value="on">{at('on', lang)}</option>
          <option value="off">{at('off', lang)}</option>
        </select>
      </label>
    {/each}
  </div>

  <div class="row">
    {#if deleteStep === 0}
      <button type="button" onclick={() => (deleteStep = 1)}>{at('remove', lang)}</button>
    {:else if deleteStep === 1}
      <p>{at('removeForever', lang)}</p>
      <button type="button" onclick={() => (deleteStep = 2)}>{at('yes', lang)}</button>
      <button type="button" onclick={() => (deleteStep = 0)}>{st('cancel', lang)}</button>
    {:else}
      <label>{at('typeName', lang)} <input bind:value={typed} /></label>
      <button
        type="button"
        disabled={typed.trim() !== student.name}
        onclick={() => run((api) => api.deleteStudent({ learnerId: student.id }))}
      >
        {at('removeNow', lang)}
      </button>
      <button type="button" onclick={() => ((deleteStep = 0), (typed = ''))}>
        {st('cancel', lang)}
      </button>
    {/if}
  </div>
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
</div>

<style>
  .actions {
    padding: 12px;
    margin-top: 8px;
    border-radius: 12px;
    background: var(--color-card);
  }
</style>

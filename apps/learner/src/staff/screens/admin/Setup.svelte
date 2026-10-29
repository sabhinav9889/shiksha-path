<script lang="ts">
  import type { AdminSetup } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import type { StaffApi } from '../../staff-api.js';
  import { staffState } from '../../staff-state.svelte.js';
  import DeleteGroup from './DeleteGroup.svelte';
  import StaffEdit from './StaffEdit.svelte';

  /** Labs, cohorts and staff invites (spec §8.1 setup). */
  let { lang }: { lang: Lang } = $props();
  let setup = $state<AdminSetup | null>(null);
  let failed = $state(false);
  let labName = $state('');
  let cohortName = $state('');
  let cohortLab = $state('');
  let invite = $state({ name: '', email: '', role: 'mentor' as 'mentor' | 'admin' });
  let inviteCohorts = $state<string[]>([]);

  const labOf = (id: string | null): string =>
    setup?.labs.find((l) => l.id === id)?.name ?? at('noLab', lang);

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.setup();
    if (result?.ok) setup = result.value;
    else failed = true;
  }

  /** Run one save; on success reload the lists and say so. */
  async function run(work: (api: StaffApi) => Promise<{ ok: boolean }>): Promise<boolean> {
    const api = staffState.auth?.api;
    failed = false;
    const ok = api ? (await work(api)).ok : false;
    failed = !ok;
    if (ok) await load();
    return ok;
  }

  async function addLab(event: Event): Promise<void> {
    event.preventDefault();
    if (await run((api) => api.saveLab({ name: labName }))) labName = '';
  }

  async function addCohort(event: Event): Promise<void> {
    event.preventDefault();
    const body = { name: cohortName, labId: cohortLab || null };
    if (await run((api) => api.saveCohort(body))) cohortName = '';
  }

  async function addStaff(event: Event): Promise<void> {
    event.preventDefault();
    const body = { ...invite, active: true, cohortIds: inviteCohorts };
    if (!(await run((api) => api.saveStaff(body)))) return;
    invite = { name: '', email: '', role: 'mentor' };
    inviteCohorts = [];
  }

  onMount(load);
</script>

<div class="admin">
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
  {#if !setup}
    <p>{st('loading', lang)}</p>
  {:else}
    <h2>{at('labs', lang)}</h2>
    <ul>
      {#each setup.labs as lab (lab.id)}
        <li>
          {lab.name}
          <DeleteGroup kind="lab" id={lab.id} name={lab.name} {lang} ondeleted={load} />
        </li>
      {/each}
    </ul>
    <form onsubmit={addLab}>
      <label>{at('newLab', lang)} <input required maxlength="80" bind:value={labName} /></label>
      <button type="submit">{at('addLab', lang)}</button>
    </form>

    <h2>{at('cohorts', lang)}</h2>
    <ul>
      {#each setup.cohorts as c (c.id)}
        <li>
          {c.name} <span class="muted">· {labOf(c.labId)}</span>
          <DeleteGroup kind="cohort" id={c.id} name={c.name} {lang} ondeleted={load} />
        </li>
      {/each}
    </ul>
    <form onsubmit={addCohort}>
      <label>{at('newCohort', lang)} <input required maxlength="80" bind:value={cohortName} /></label>
      <label>
        {at('lab', lang)}
        <select bind:value={cohortLab}>
          <option value="">{at('noLab', lang)}</option>
          {#each setup.labs as lab (lab.id)}<option value={lab.id}>{lab.name}</option>{/each}
        </select>
      </label>
      <button type="submit">{at('addCohort', lang)}</button>
    </form>

    <h2>{at('staff', lang)}</h2>
    <ul>
      {#each setup.staff as s (s.id)}
        <li>
          <strong>{s.name}</strong> <span>{s.email}</span> · {st(s.role, lang)}
          {#if !s.claimed}<span class="muted">· {at('waitingClaim', lang)}</span>{/if}
          {#if !s.active}<span class="muted">· {at('paused', lang)}</span>{/if}
          <StaffEdit member={s} cohorts={setup.cohorts} {lang} onsaved={load} />
        </li>
      {/each}
    </ul>
    <form onsubmit={addStaff}>
      <label>{at('staffName', lang)} <input required maxlength="80" bind:value={invite.name} /></label>
      <label>{at('email', lang)} <input required type="email" bind:value={invite.email} /></label>
      <label>
        {at('role', lang)}
        <select bind:value={invite.role}>
          <option value="mentor">{st('mentor', lang)}</option>
          <option value="admin">{st('admin', lang)}</option>
        </select>
      </label>
      {#each setup.cohorts as c (c.id)}
        <label class="check">
          <input type="checkbox" value={c.id} bind:group={inviteCohorts} />
          {c.name}
        </label>
      {/each}
      <button type="submit">{at('invite', lang)}</button>
    </form>
  {/if}
</div>

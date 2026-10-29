<script lang="ts">
  import type { AdminSetup } from '@shiksha/api-contract/staff';
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';
  import DeleteGroup from './DeleteGroup.svelte';
  import StaffEdit from './StaffEdit.svelte';

  /** Mentors and admins as rows (who, role, cohorts, actions), and the invite form. */
  let {
    setup,
    lang,
    reload,
  }: { setup: AdminSetup; lang: Lang; reload: () => Promise<void> } = $props();
  let failed = $state(false);
  let invite = $state({ name: '', email: '', role: 'mentor' as 'mentor' | 'admin' });
  let inviteCohorts = $state<string[]>([]);

  const cohortNames = (ids: string[]): string =>
    setup.cohorts
      .filter((c) => ids.includes(c.id))
      .map((c) => c.name)
      .join(', ') || at('noCohortsAssigned', lang);

  async function addStaff(event: Event): Promise<void> {
    event.preventDefault();
    const body = { ...invite, active: true, cohortIds: inviteCohorts };
    const result = await staffState.auth?.api.saveStaff(body);
    failed = !result?.ok;
    if (failed) return;
    invite = { name: '', email: '', role: 'mentor' };
    inviteCohorts = [];
    await reload();
  }
</script>

<section class="panel">
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
  <h2>{at('staff', lang)}</h2>
  <ul>
    {#each setup.staff as s (s.id)}
      <li class="person">
        <span class="who">
          <strong>{s.name}</strong>
          <span class="muted">{s.email}</span>
          <span class="muted">{cohortNames(s.cohortIds)}</span>
        </span>
        <span class="actions">
          <span class="badge">{st(s.role, lang)}</span>
          {#if !s.claimed}<span class="muted">{at('waitingClaim', lang)}</span>{/if}
          {#if !s.active}<span class="muted">{at('paused', lang)}</span>{/if}
          <StaffEdit member={s} cohorts={setup.cohorts} {lang} onsaved={reload} />
          <DeleteGroup kind="staff" id={s.id} name={s.name} {lang} ondeleted={reload} />
        </span>
      </li>
    {/each}
  </ul>
  <form onsubmit={addStaff}>
    <label>
      {at('staffName', lang)} <input required maxlength="80" bind:value={invite.name} />
    </label>
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
</section>

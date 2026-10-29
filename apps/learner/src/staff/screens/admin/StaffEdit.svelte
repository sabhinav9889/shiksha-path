<script lang="ts">
  import type { AdminSetup } from '@shiksha/api-contract/staff';
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';

  type Member = AdminSetup['staff'][number];

  /** Pause a staff member, change their role or cohorts. Pausing ends their access at once. */
  let {
    member,
    cohorts,
    lang,
    onsaved,
  }: {
    member: Member;
    cohorts: AdminSetup['cohorts'];
    lang: Lang;
    onsaved: () => Promise<void>;
  } = $props();
  let open = $state(false);
  const draft = $state({ active: true, role: 'mentor' as Member['role'], cohortIds: [] as string[] });
  let failed = $state(false);

  function start(): void {
    draft.active = member.active;
    draft.role = member.role;
    draft.cohortIds = [...member.cohortIds];
    open = true;
  }

  async function save(): Promise<void> {
    const body = { id: member.id, email: member.email, name: member.name, ...draft };
    const result = await staffState.auth?.api.saveStaff(body);
    failed = !result?.ok;
    if (failed) return;
    open = false;
    await onsaved();
  }
</script>

{#if open}
  <div class="row" data-testid="staff-edit">
    <label class="check"><input type="checkbox" bind:checked={draft.active} /> {at('active', lang)}</label>
    <label>
      {at('role', lang)}
      <select bind:value={draft.role}>
        <option value="mentor">{st('mentor', lang)}</option>
        <option value="admin">{st('admin', lang)}</option>
      </select>
    </label>
    {#each cohorts as c (c.id)}
      <label class="check">
        <input type="checkbox" value={c.id} bind:group={draft.cohortIds} />
        {c.name}
      </label>
    {/each}
    <button type="button" onclick={save}>{at('save', lang)}</button>
    <button type="button" class="quiet" onclick={() => (open = false)}>{st('cancel', lang)}</button>
    {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
  </div>
{:else}
  <button
    type="button"
    class="quiet"
    aria-label={at('editLabel', lang, { name: member.name })}
    onclick={start}>{at('edit', lang)}</button
  >
{/if}

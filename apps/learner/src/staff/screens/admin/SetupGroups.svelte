<script lang="ts">
  import type { AdminSetup } from '@shiksha/api-contract/staff';
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import type { StaffApi } from '../../staff-api.js';
  import { staffState } from '../../staff-state.svelte.js';
  import DeleteGroup from './DeleteGroup.svelte';

  /** Each lab with its cohorts inside it, then the cohorts that have no lab; two small forms. */
  let {
    setup,
    lang,
    reload,
  }: { setup: AdminSetup; lang: Lang; reload: () => Promise<void> } = $props();
  let failed = $state(false);
  let labName = $state('');
  let cohortName = $state('');
  let cohortLab = $state('');

  const cohortsIn = (labId: string | null): AdminSetup['cohorts'] =>
    setup.cohorts.filter((c) => c.labId === labId);
  const loose = $derived(cohortsIn(null));

  /** Run one save; on success reload the lists. */
  async function run(work: (api: StaffApi) => Promise<{ ok: boolean }>): Promise<boolean> {
    const api = staffState.auth?.api;
    const ok = api ? (await work(api)).ok : false;
    failed = !ok;
    if (ok) await reload();
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
</script>

{#snippet cohortRow(c: AdminSetup['cohorts'][number])}
  <li class="item">
    <strong>{c.name}</strong>
    <span class="actions">
      <DeleteGroup kind="cohort" id={c.id} name={c.name} {lang} ondeleted={reload} />
    </span>
  </li>
{/snippet}

<section class="panel">
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
  <h2>{at('labs', lang)} · {at('cohorts', lang)}</h2>
  {#each setup.labs as lab (lab.id)}
    <div class="group">
      <header>
        <strong>{lab.name}</strong>
        <span class="actions">
          <DeleteGroup kind="lab" id={lab.id} name={lab.name} {lang} ondeleted={reload} />
        </span>
      </header>
      <ul>
        {#each cohortsIn(lab.id) as c (c.id)}{@render cohortRow(c)}{:else}
          <li class="item muted">{at('noCohortsYet', lang)}</li>
        {/each}
      </ul>
    </div>
  {/each}
  {#if loose.length > 0}
    <div class="group">
      <header><strong>{at('noLab', lang)}</strong></header>
      <ul>
        {#each loose as c (c.id)}{@render cohortRow(c)}{/each}
      </ul>
    </div>
  {/if}
  <div class="forms">
    <form onsubmit={addLab}>
      <label>{at('newLab', lang)} <input required maxlength="80" bind:value={labName} /></label>
      <button type="submit">{at('addLab', lang)}</button>
    </form>
    <form onsubmit={addCohort}>
      <label>
        {at('newCohort', lang)} <input required maxlength="80" bind:value={cohortName} />
      </label>
      <label>
        {at('lab', lang)}
        <select bind:value={cohortLab}>
          <option value="">{at('noLab', lang)}</option>
          {#each setup.labs as lab (lab.id)}<option value={lab.id}>{lab.name}</option>{/each}
        </select>
      </label>
      <button type="submit">{at('addCohort', lang)}</button>
    </form>
  </div>
</section>

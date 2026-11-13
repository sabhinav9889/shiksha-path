<script lang="ts">
  import type { AdminSetup } from '@shiksha/api-contract/staff';
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';

  /**
   * Rename a lab, or rename and move a cohort to another lab (or none). An admin-only edit; the
   * server refuses a lab or cohort that is no longer there, and we say it did not work.
   */
  let {
    kind,
    id,
    name,
    labId = null,
    labs,
    lang,
    open,
    onopen,
    onclose,
    onsaved,
  }: {
    kind: 'lab' | 'cohort';
    id: string;
    name: string;
    labId?: string | null;
    labs: AdminSetup['labs'];
    lang: Lang;
    open: boolean;
    onopen: () => void;
    onclose: () => void;
    onsaved: () => Promise<void>;
  } = $props();
  let draft = $state('');
  let draftLab = $state('');
  let busy = $state(false);
  let failed = $state(false);
  let input = $state<HTMLInputElement>();
  let editButton = $state<HTMLButtonElement>();
  let focusButton = false; // set when a form closes, so the keyboard lands back on Edit
  const label = $derived(at('editLabel', lang, { name }));

  /** Keyboard users keep their place: the name field on open, the Edit button after close. */
  $effect(() => {
    if (open) input?.focus();
    else if (focusButton && editButton) {
      focusButton = false;
      editButton.focus();
    }
  });

  function close(): void {
    focusButton = true;
    onclose();
  }

  function start(): void {
    draft = name;
    draftLab = labId ?? '';
    failed = false;
    onopen();
  }

  async function save(event: Event): Promise<void> {
    event.preventDefault();
    const api = staffState.auth?.api;
    if (!api || busy) return; // a second tap must not send a second save
    busy = true;
    const result =
      kind === 'lab'
        ? await api.saveLab({ id, name: draft })
        : await api.saveCohort({ id, name: draft, labId: draftLab || null });
    busy = false;
    failed = !result.ok;
    if (result.ok) close();
    await onsaved(); // after a failed save too: the list may be stale (deleted meanwhile)
  }
</script>

{#if open}
  <form class="edit" aria-label={label} onsubmit={save}>
    <label>
      {at(kind === 'lab' ? 'labName' : 'cohortName', lang)}
      <input required maxlength="80" bind:value={draft} bind:this={input} />
    </label>
    {#if kind === 'cohort'}
      <label>
        {at('lab', lang)}
        <select bind:value={draftLab}>
          <option value="">{at('noLab', lang)}</option>
          {#each labs as lab (lab.id)}<option value={lab.id}>{lab.name}</option>{/each}
        </select>
      </label>
    {/if}
    <button type="submit" disabled={busy}>{at('save', lang)}</button>
    <button type="button" class="quiet" disabled={busy} onclick={close}>
      {st('cancel', lang)}
    </button>
    {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
  </form>
{:else}
  <button
    type="button"
    class="quiet"
    aria-label={label}
    bind:this={editButton}
    onclick={start}
  >
    {at('edit', lang)}
  </button>
{/if}

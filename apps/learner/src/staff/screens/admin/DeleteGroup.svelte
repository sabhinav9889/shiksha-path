<script lang="ts">
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';

  /**
   * Delete an empty cohort or lab, or a staff member: one question first. A busy cohort or lab is
   * refused, and we say why.
   */
  let {
    kind,
    id,
    name,
    lang,
    ondeleted,
  }: {
    kind: 'cohort' | 'lab' | 'staff' | 'post' | 'slot';
    id: string;
    name: string;
    lang: Lang;
    ondeleted: () => Promise<void>;
  } = $props();
  let asking = $state(false);
  let busy = $state(false);
  let error = $state<Why | null>(null);

  const SURE = {
    lab: 'deleteLabSure',
    cohort: 'deleteCohortSure',
    staff: 'deleteStaffSure',
    post: 'deletePostSure',
    slot: 'deleteSlotSure',
  } as const;
  type Why = 'busy' | 'refused' | 'failed';
  /** NOT_EMPTY: has students or cohorts. INVALID_REQUEST on staff: yourself, or already gone. */
  function whyNot(result: { ok: boolean; error?: string } | undefined): Why {
    if (result?.error === 'NOT_EMPTY') return 'busy';
    return kind === 'staff' && result?.error === 'INVALID_REQUEST' ? 'refused' : 'failed';
  }

  function send(): Promise<{ ok: boolean; error?: string }> | undefined {
    const api = staffState.auth?.api;
    const calls = {
      lab: api?.deleteLab,
      cohort: api?.deleteCohort,
      staff: api?.deleteStaff,
      post: api?.deletePost,
      slot: api?.deleteSlot,
    };
    return calls[kind]?.({ id });
  }

  async function confirm(): Promise<void> {
    busy = true; // a second tap must not send a second delete
    const result = await send();
    asking = false;
    busy = false;
    if (result?.ok) return ondeleted();
    error = whyNot(result);
  }
</script>

<span class="delete">
  {#if asking}
    <span class="sure">{at(SURE[kind], lang)}</span>
    <button
      type="button"
      class="danger"
      disabled={busy}
      aria-label={`${name}: ${at('yes', lang)}`}
      onclick={confirm}
    >
      {at('yes', lang)}
    </button>
    <button
      type="button"
      class="quiet"
      disabled={busy}
      aria-label={`${name}: ${st('cancel', lang)}`}
      onclick={() => (asking = false)}
    >
      {st('cancel', lang)}
    </button>
  {:else}
    <button
      type="button"
      class="quiet"
      aria-label={`${name}: ${at('remove', lang)}`}
      onclick={() => ((asking = true), (error = null))}
    >
      {at('remove', lang)}
    </button>
  {/if}
</span>
{#if error === 'busy'}
  <p role="alert" class="alert">{at(kind === 'lab' ? 'labNotEmpty' : 'cohortNotEmpty', lang)}</p>
{:else if error === 'refused'}
  <p role="alert" class="alert">{at('staffNotDeleted', lang)}</p>
{:else if error}
  <p role="alert" class="alert">{st('failed', lang)}</p>
{/if}

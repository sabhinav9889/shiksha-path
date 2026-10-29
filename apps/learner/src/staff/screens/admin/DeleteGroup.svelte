<script lang="ts">
  import type { Lang } from '../../../i18n/index.js';
  import { at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';

  /** Delete an empty cohort or lab: one question first. A busy one is refused, and we say why. */
  let {
    kind,
    id,
    name,
    lang,
    ondeleted,
  }: {
    kind: 'cohort' | 'lab';
    id: string;
    name: string;
    lang: Lang;
    ondeleted: () => Promise<void>;
  } = $props();
  let asking = $state(false);
  let busy = $state(false);
  let error = $state<'busy' | 'failed' | null>(null);

  const refusedAsBusy = (result: { ok: boolean; error?: string } | undefined): boolean =>
    result?.error === 'NOT_EMPTY';

  async function confirm(): Promise<void> {
    busy = true; // a second tap must not send a second delete
    const api = staffState.auth?.api;
    const result = await (kind === 'lab' ? api?.deleteLab({ id }) : api?.deleteCohort({ id }));
    asking = false;
    busy = false;
    if (result?.ok) return ondeleted();
    error = refusedAsBusy(result) ? 'busy' : 'failed';
  }
</script>

{#if asking}
  <span>{at(kind === 'lab' ? 'deleteLabSure' : 'deleteCohortSure', lang)}</span>
  <button type="button" disabled={busy} aria-label={`${name}: ${at('yes', lang)}`} onclick={confirm}>
    {at('yes', lang)}
  </button>
  <button
    type="button"
    disabled={busy}
    aria-label={`${name}: ${st('cancel', lang)}`}
    onclick={() => (asking = false)}
  >
    {st('cancel', lang)}
  </button>
{:else}
  <button
    type="button"
    aria-label={`${name}: ${at('remove', lang)}`}
    onclick={() => ((asking = true), (error = null))}
  >
    {at('remove', lang)}
  </button>
{/if}
{#if error === 'busy'}
  <p role="alert">{at(kind === 'lab' ? 'labNotEmpty' : 'cohortNotEmpty', lang)}</p>
{:else if error}
  <p role="alert">{st('failed', lang)}</p>
{/if}

<script lang="ts">
  import type { StaffPost } from '@shiksha/api-contract/staff';
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { ct } from '../community-i18n.js';
  import { draftOf, requestOf } from '../post-draft.js';
  import { staffState } from '../staff-state.svelte.js';

  /** Write a post, or change one. Text stays plain text; a session link must be https. */
  let {
    lang,
    editing = null,
    onsaved,
    oncancel,
  }: {
    lang: Lang;
    editing?: StaffPost | null;
    onsaved: () => Promise<void>;
    oncancel: () => void;
  } = $props();

  const me = $derived(staffState.me);
  // The form is keyed on the post being changed, so the first values are all it needs.
  // svelte-ignore state_referenced_locally
  let draft = $state(draftOf(editing, me));
  let failed = $state(false);
  let busy = $state(false);

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return; // a second tap must not post twice
    busy = true;
    const result = await staffState.auth?.api.savePost(requestOf(draft, editing?.id));
    busy = false;
    failed = !result?.ok;
    if (failed) return;
    draft = draftOf(editing, me);
    await onsaved();
  }
</script>

<form onsubmit={submit} data-testid="post-form">
  <h2>{ct(editing ? 'editPost' : 'newPost', lang)}</h2>
  <p class="warning">{ct('warning', lang)}</p>
  <label>{ct('postTitle', lang)} <input required maxlength="120" bind:value={draft.title} /></label>
  <label>
    {ct('postBody', lang)}
    <textarea rows="4" maxlength="4000" bind:value={draft.body}></textarea>
  </label>
  <label>
    {ct('audience', lang)}
    <select bind:value={draft.audience}>
      {#if me?.role === 'admin'}<option value="all">{ct('everyone', lang)}</option>{/if}
      {#each me?.cohorts ?? [] as cohort (cohort.id)}
        <option value={cohort.id}>{cohort.name}</option>
      {/each}
    </select>
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={draft.session} />
    {ct('isSession', lang)}
  </label>
  {#if draft.session}
    <label>
      {ct('startsAt', lang)}
      <input required type="datetime-local" bind:value={draft.startsAt} />
    </label>
    <label>
      {ct('minutes', lang)}
      <input required type="number" min="15" max="480" bind:value={draft.minutes} />
    </label>
    <label>
      {ct('joinLink', lang)}
      <input type="url" maxlength="500" placeholder="https://" bind:value={draft.link} />
    </label>
  {/if}
  <div class="actions">
    <button type="submit" disabled={busy}>
      {ct(editing ? 'saveChanges' : 'publish', lang)}
    </button>
    {#if editing}
      <button type="button" class="quiet" onclick={oncancel}>{st('cancel', lang)}</button>
    {/if}
  </div>
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
</form>

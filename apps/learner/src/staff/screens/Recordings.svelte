<script lang="ts">
  import type { UnreviewedRecordings } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { createBusy } from '../busy.svelte.js';
  import { staffState } from '../staff-state.svelte.js';
  import { whenWords } from '../words.js';

  type Item = UnreviewedRecordings['recordings'][number];

  /** Recordings waiting for review. The audio URL is fetched only when the mentor taps play. */
  let { lang }: { lang: Lang } = $props();
  const working = createBusy();
  let items = $state<Item[] | null>(null);
  let failed = $state(false);
  const urls = $state<Record<string, string>>({});
  const comments = $state<Record<string, string>>({});

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.unreviewed();
    if (result?.ok) items = result.value.recordings;
    else failed = true;
  }

  const listen = (item: Item): Promise<void | undefined> => working.run(() => doListen(item));
  const review = (item: Item): Promise<void | undefined> => working.run(() => doReview(item));

  async function doListen(item: Item): Promise<void> {
    const result = await staffState.auth?.api.recordingUrl(item.id);
    if (!result?.ok) {
      failed = true;
      return;
    }
    urls[item.id] = result.value.url;
  }

  async function doReview(item: Item): Promise<void> {
    const comment = comments[item.id]?.trim();
    const body = comment ? { id: item.id, comment } : { id: item.id };
    const result = await staffState.auth?.api.review(body);
    if (!result?.ok) {
      failed = true;
      return;
    }
    await load();
  }

  onMount(load);
</script>

{#if failed}
  <p role="alert">{st('failed', lang)}</p>
{/if}
{#if !items}
  <p>{st('loading', lang)}</p>
{:else if items.length === 0}
  <p>{st('allReviewed', lang)}</p>
{:else}
  <ul>
    {#each items as item (item.id)}
      <li>
        <p><strong>{item.learnerName}</strong> · {whenWords(item.uploadedAt, lang)}</p>
        {#if urls[item.id]}
          <audio controls autoplay src={urls[item.id]}></audio>
        {:else}
          <button type="button" disabled={working.busy} onclick={() => listen(item)}>
            {st('listen', lang, { lesson: item.lessonId })}
          </button>
        {/if}
        <label>
          {st('comment', lang)}
          <input maxlength="280" bind:value={comments[item.id]} />
        </label>
        <button type="button" disabled={working.busy} onclick={() => review(item)}>
          {st('markReviewed', lang)}
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul {
    list-style: none;
    padding: 0;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-line);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  button {
    min-height: 44px;
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.7;
  }
</style>

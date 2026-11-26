<script lang="ts">
  import { myRecordingUrlResponse, type MyRecording } from '@shiksha/api-contract';
  import { onMount } from 'svelte';
  import { linkedApi } from '../../account/account.js';
  import { appState } from '../../app-state.svelte.js';
  import { postDate } from '../../community/session-time.js';
  import { fb } from './feedback-i18n.js';
  import { loadFeedbackCache, refreshFeedback, type FeedbackStatus } from './feedback-cache.js';

  /** The student's own speaking recordings and what a mentor said: the phone's copy, refreshed. */
  let recordings = $state<MyRecording[]>([]);
  let status = $state<FeedbackStatus | null>(null); // null while it loads, so no false "offline"
  let player = $state<{ id: string; url: string } | null>(null);
  let notice = $state<{ id: string; text: 'needsNet' | 'playFailed' } | null>(null);
  const lang = $derived(appState.lang);
  const seconds = (ms: number): number => Math.max(1, Math.round(ms / 1000));

  onMount(async () => {
    const { runtime, profile } = appState;
    if (!runtime || !profile) return;
    recordings = (await loadFeedbackCache(runtime, profile.id)) ?? [];
    const fresh = await refreshFeedback(runtime, await linkedApi(runtime, profile.id), profile.id);
    if (appState.profile?.id !== profile.id) return; // the student changed while it loaded
    recordings = fresh.recordings;
    status = fresh.status;
  });

  /** A short-lived link to the student's own recording; playing needs the internet. */
  async function play(id: string): Promise<void> {
    const { runtime, profile } = appState;
    notice = null;
    player = null;
    if (!runtime || !profile) return;
    const client = await linkedApi(runtime, profile.id);
    const answer = await client?.call(
      `/v1/me/recording-url?id=${encodeURIComponent(id)}`,
      myRecordingUrlResponse,
    );
    if (appState.profile?.id !== profile.id) return;
    if (answer?.ok) player = { id, url: answer.value.url };
    else notice = { id, text: !answer || answer.error === 'OFFLINE' ? 'needsNet' : 'playFailed' };
  }
</script>

{#if recordings.length > 0}
  <section class="card">
    <h2>{fb('title', lang)}</h2>
    <ul>
      {#each recordings as r (r.id)}
        <li>
          <div class="head">
            <span class="muted">{postDate(r.recordedAt, lang)} · {seconds(r.durationMs)} {fb('seconds', lang)}</span>
            <strong class:seen={r.reviewedAt !== null}>
              {r.reviewedAt ? fb('reviewed', lang) : fb('waiting', lang)}
            </strong>
          </div>
          {#if r.comment}
            <blockquote>
              <span class="muted">{fb('comment', lang)}</span>
              <p>{r.comment}</p>
            </blockquote>
          {/if}
          <button type="button" onclick={() => play(r.id)}>{fb('play', lang)}</button>
          {#if player?.id === r.id}
            <audio
              controls
              autoplay
              src={player.url}
              onerror={() => (notice = { id: r.id, text: 'playFailed' })}
            ></audio>
          {/if}
          {#if notice?.id === r.id}
            <p class="muted" role="status">{fb(notice.text, lang)}</p>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="muted">{fb('retention', lang)}</p>
    {#if status === 'offline'}<p class="muted">{fb('offline', lang)}</p>{/if}
  </section>
{/if}

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  h2 {
    margin: 0;
    font-size: 16px;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border, rgb(0 0 0 / 10%));
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    justify-content: space-between;
  }

  .seen {
    color: var(--color-primary);
  }

  blockquote {
    margin: 0;
    padding-left: 10px;
    border-left: 3px solid var(--color-primary);
  }

  blockquote p {
    margin: 2px 0 0;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }

  button {
    align-self: flex-start;
    min-height: 44px;
    padding: 0 18px;
    border: 1.5px solid var(--color-primary);
    border-radius: 14px;
    background: var(--color-card);
    color: var(--color-primary);
    font-size: 16px;
    font-weight: 600;
  }

  audio {
    width: 100%;
  }
</style>

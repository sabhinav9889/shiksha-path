<script lang="ts">
  import type { FeedPost } from '@shiksha/api-contract';
  import { onMount } from 'svelte';
  import { linkedApi } from '../account/account.js';
  import { appState } from '../app-state.svelte.js';
  import { cs } from './community-i18n.js';
  import { loadFeedCache, refreshFeed, type FeedStatus } from './feed-cache.js';
  import { calendarLink } from './calendar-link.js';
  import { countdown, postDate, safeLink, sessionState, sessionWhen } from './session-time.js';

  /** The posts mentors wrote for this student, from the phone's copy first, then refreshed. */
  let posts = $state<FeedPost[] | null>(null);
  let status = $state<FeedStatus>('offline');

  const lang = $derived(appState.lang);
  const byline = (post: FeedPost): string =>
    [
      post.authorName ?? appState.brand.name[lang],
      postDate(post.createdAt, lang),
      ...(post.editedAt ? [cs('edited', lang)] : []),
    ].join(' · ');
  const now = (): Date => appState.runtime?.clock.now() ?? new Date();

  onMount(async () => {
    const { runtime, profile } = appState;
    if (!runtime || !profile) return;
    posts = (await loadFeedCache(runtime, profile.id))?.posts ?? [];
    const fresh = await refreshFeed(runtime, await linkedApi(runtime, profile.id), profile.id);
    if (appState.profile?.id !== profile.id) return; // the student changed while it loaded
    posts = fresh.posts;
    status = fresh.status;
  });
</script>

<section class="community">
  <h1>{cs('title', lang)}</h1>
  {#if posts === null}
    <p>{cs('loading', lang)}</p>
  {:else}
    {#if status === 'off'}
      <p class="note" role="status">{cs('off', lang)}</p>
    {:else if status === 'offline' && posts.length > 0}
      <p class="note" role="status">{cs('offline', lang)}</p>
    {/if}
    {#each posts as post (post.id)}
      {@const session = post.session}
      {@const state = session ? sessionState(session.startsAt, session.minutes, now()) : null}
      {@const link = session ? safeLink(session.link) : null}
      <article class="card">
        <h2>{post.title}</h2>
        <p class="meta">{byline(post)}</p>
        {#if post.toCohort}<span class="badge">{cs('forCohort', lang)}</span>{/if}
        {#if post.body}<p class="body">{post.body}</p>{/if}
        {#if session && state}
          <div class="session">
            <strong>{cs('session', lang)}</strong>
            <span>
              {sessionWhen(session.startsAt, lang)} · {cs('minutes', lang, {
                minutes: session.minutes,
              })}
            </span>
            <span class="state {state}">
              {countdown(session.startsAt, session.minutes, now(), lang)}
            </span>
            {#if link && state !== 'over'}
              <a href={link} target="_blank" rel="noopener noreferrer">{cs('join', lang)}</a>
            {/if}
            {#if state !== 'over'}
              <a
                class="quiet"
                href={calendarLink({
                  title: post.title,
                  startsAt: session.startsAt,
                  minutes: session.minutes,
                  joinLink: link,
                })}
                target="_blank"
                rel="noopener noreferrer">{cs('addToCalendar', lang)}</a
              >
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      <p class="empty">{cs('empty', lang)}</p>
    {/each}
  {/if}
</section>

<style>
  .community {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 24px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  h2 {
    margin: 0;
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  .meta,
  .empty,
  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: 14px;
  }

  .badge {
    align-self: flex-start;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
    font-size: 13px;
    font-weight: 600;
  }

  .body {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .session {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--radius-s);
    background: var(--color-bg);
  }

  .state {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--color-primary-soft);
    font-size: 13px;
    font-weight: 600;
  }

  .state.live {
    background: var(--color-correct-bg);
    color: var(--color-correct);
  }

  .state.over {
    color: var(--color-muted);
  }

  a.quiet {
    border: 1px solid var(--color-primary);
    background: var(--color-card);
    color: var(--color-primary-dark);
  }

  a {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-min);
    padding: 0 16px;
    border-radius: var(--radius-s);
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
    text-decoration: none;
  }
</style>

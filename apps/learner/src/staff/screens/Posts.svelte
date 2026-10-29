<script lang="ts">
  import type { StaffPost } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import type { Lang } from '../../i18n/index.js';
  import { at } from '../admin-i18n.js';
  import { ct } from '../community-i18n.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import { sessionWhen } from '../../community/session-time.js';
  import { whenWords } from '../words.js';
  import DeleteGroup from './admin/DeleteGroup.svelte';
  import PostForm from './PostForm.svelte';
  import './admin/setup.css';

  /** Mentors and admins write posts for students; each author edits or deletes their own. */
  let { lang }: { lang: Lang } = $props();
  let posts = $state<StaffPost[] | null>(null);
  let failed = $state(false);
  let editing = $state<StaffPost | null>(null);

  const audienceOf = (post: StaffPost): string =>
    post.cohortId === null
      ? ct('toEveryone', lang)
      : (staffState.me?.cohorts.find((c) => c.id === post.cohortId)?.name ?? at('cohorts', lang));

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.posts();
    if (result?.ok) posts = result.value.posts;
    else failed = true;
  }

  async function saved(): Promise<void> {
    editing = null;
    await load();
  }

  onMount(load);
</script>

<div class="setup">
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
  <section class="panel">
    {#key editing?.id}
      <PostForm {lang} {editing} onsaved={saved} oncancel={() => (editing = null)} />
    {/key}
  </section>
  <section class="panel">
    {#if !posts}
      <p>{st('loading', lang)}</p>
    {:else if posts.length === 0}
      <p class="muted">{ct('noPosts', lang)}</p>
    {:else}
      <ul>
        {#each posts as post (post.id)}
          <li class="person">
            <span class="who">
              <strong>{post.title}</strong>
              <span class="muted">
                {audienceOf(post)}{post.authorName ? ` · ${ct('by', lang)} ${post.authorName}` : ''}
                · {whenWords(post.createdAt, lang)}{post.editedAt ? ` · ${ct('edited', lang)}` : ''}
              </span>
              {#if post.session}
                <span class="muted">
                  {ct('sessionAt', lang, {
                    when: sessionWhen(post.session.startsAt, lang),
                    minutes: post.session.minutes,
                  })}
                </span>
              {/if}
              {#if post.body}<span class="body">{post.body}</span>{/if}
            </span>
            <span class="actions">
              {#if post.canEdit}
                <button
                  type="button"
                  class="quiet"
                  aria-label={`${post.title}: ${at('edit', lang)}`}
                  onclick={() => (editing = post)}>{at('edit', lang)}</button
                >
              {/if}
              {#if post.canDelete}
                <DeleteGroup kind="post" id={post.id} name={post.title} {lang} ondeleted={saved} />
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<script lang="ts">
  import type { StudentDetail } from '@shiksha/api-contract/staff';
  import { parseEvents } from '@shiksha/learner-core';
  import { onMount } from 'svelte';
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import { activityLine, whenWords } from '../words.js';
  import AttentionBadge from './AttentionBadge.svelte';
  import IssueCode from './IssueCode.svelte';
  import SetLevel from './SetLevel.svelte';

  /** One student: progress, what they did in plain words, weak lessons, recordings. */
  let { id, lang }: { id: string; lang: Lang } = $props();
  let detail = $state<StudentDetail | null>(null);
  let failed = $state(false);

  const activity = $derived(
    detail
      ? parseEvents(detail.recent)
          .events.map((e) => ({ id: e.id, at: e.at, line: activityLine(e, lang) }))
          .filter((a) => a.line !== null)
      : [],
  );

  onMount(async () => {
    const result = await staffState.auth?.api.student(id);
    if (result?.ok) detail = result.value;
    else failed = true;
  });
</script>

{#if failed}
  <p role="alert">{st('failed', lang)}</p>
{:else if !detail}
  <p>{st('loading', lang)}</p>
{:else}
  <h2>{detail.student.name}</h2>
  <AttentionBadge flags={detail.attention} {lang} />
  <p>
    {st('lessonsDone', lang, { n: detail.summary?.lessonsDone ?? 0 })} ·
    {st('thisWeek', lang, { n: detail.summary?.lessonsThisWeek ?? 0 })} ·
    {st('streak', lang, { n: detail.summary?.streak ?? 0 })}
  </p>

  <IssueCode learnerId={detail.student.id} hasCode={detail.hasCode} {lang} />
  <SetLevel learnerId={detail.student.id} {lang} />

  <h3>{st('recentActivity', lang)}</h3>
  <ul>
    {#each activity as a (a.id)}
      <li><span>{a.line}</span> <span class="muted">{whenWords(a.at, lang)}</span></li>
    {/each}
  </ul>

  {#if detail.weakLessons.length > 0}
    <h3>{st('weakLessons', lang)}</h3>
    <ul>
      {#each detail.weakLessons as w (w.lessonId)}
        <li>{w.lessonId} <span class="muted">{st('wrongCount', lang, { n: w.wrong })}</span></li>
      {/each}
    </ul>
  {/if}

  <h3>{st('recordings', lang)}</h3>
  <ul data-testid="student-recordings">
    {#each detail.recordings as r (r.id)}
      <li>
        {r.lessonId} · {whenWords(r.recordedAt, lang)} ·
        <span class="muted">{st(r.reviewedAt ? 'reviewed' : 'waiting', lang)}</span>
        {#if r.comment}<q>{r.comment}</q>{/if}
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
    padding: 8px 0;
    border-bottom: 1px solid var(--color-line);
  }

  .muted {
    color: var(--color-muted);
    font-size: 14px;
  }
</style>

<script lang="ts">
  import type { Localized } from '@shiksha/content/schema';
  import { t, type Lang } from '../../i18n/index.js';

  const WEEK = Array.from({ length: 7 }, (_, i) => i);
  const FULL = 100;

  interface Props {
    lang: Lang;
    streak: { current: number; activeToday: boolean };
    tracks: { id: string; title: Localized; done: number; total: number }[];
  }

  let { lang, streak, tracks }: Props = $props();
</script>

<div class="card">
  <span class="label">{t('home.streak', lang)}</span>
  <strong>{t('home.days', lang, { count: streak.current })}</strong>
  <div class="week" aria-hidden="true">
    {#each WEEK as day (day)}
      <span class:on={day < streak.current}></span>
    {/each}
  </div>
</div>

{#each tracks as track (track.id)}
  <div class="card">
    <span class="label">{track.title[lang]}</span>
    <strong>{t('home.progress', lang, { done: track.done, total: track.total })}</strong>
    <div class="bar">
      <span style:width={`${track.total ? (FULL * track.done) / track.total : 0}%`}></span>
    </div>
  </div>
{/each}

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  .label {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
  }

  strong {
    font-family: var(--font-heading);
    font-size: 24px;
    line-height: 1;
  }

  .week {
    display: flex;
    gap: 4px;
  }

  .week span {
    width: 18px;
    height: 6px;
    border-radius: 3px;
    background: var(--color-line);
  }

  .week span.on {
    background: var(--color-streak);
  }

  .bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    background: var(--color-line);
  }

  .bar span {
    border-radius: 3px;
    background: var(--color-primary);
  }
</style>

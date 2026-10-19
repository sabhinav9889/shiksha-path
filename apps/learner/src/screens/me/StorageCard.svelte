<script lang="ts">
  import { megabytes, t, type Lang } from '../../i18n/index.js';
  import type { MeData } from './me-data.js';

  const FULL = 100;

  let { lang, data }: { lang: Lang; data: MeData } = $props();

  const used = $derived(megabytes(data.storage.used));
  const share = $derived(data.storage.quota ? (FULL * data.storage.used) / data.storage.quota : 0);

  function mark(state: MeData['modules'][number]['state']): string {
    if (state === 'ready' || state === 'playable') return '✓';
    return t(state === 'removed' ? 'me.removed' : 'me.notDownloaded', lang);
  }
</script>

<section class="card">
  <h2>{t('me.storage', lang)}</h2>
  {#if data.storage.quota}
    <div class="bar"><span style:width={`${Math.min(share, FULL)}%`}></span></div>
    <p>
      {t('me.usedFree', lang, {
        used,
        free: megabytes(Math.max(0, data.storage.quota - data.storage.used)),
      })}
    </p>
  {:else}
    <p>{t('me.used', lang, { used })}</p>
  {/if}
  <ul>
    {#each data.modules as module (module.id)}
      <li data-testid="module-row">
        <span>{module.title[lang]} · {t('me.size', lang, { size: megabytes(module.bytes) })}</span>
        <span class="mark" class:ok={mark(module.state) === '✓'}>{mark(module.state)}</span>
      </li>
    {/each}
  </ul>
  <p>
    {t('me.recordings', lang, {
      count: data.recordings.count,
      size: megabytes(data.recordings.bytes),
    })}
  </p>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  h2 {
    margin: 0;
    font-size: 16px;
  }

  p {
    margin: 0;
    color: var(--color-muted);
    font-size: 14px;
  }

  .bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    background: var(--color-line);
  }

  .bar span {
    border-radius: 4px;
    background: var(--color-primary);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding: 6px 0;
    border-top: 1px solid var(--color-line);
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .mark {
    flex-shrink: 0;
    color: var(--color-muted);
    font-weight: 600;
  }

  .mark.ok {
    color: var(--color-correct);
  }
</style>

<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';

  interface Props {
    lang: Lang;
    sync: { lastSyncedAt: string | null; pending: number };
    busy: boolean;
    message: string;
    onsync: () => void;
  }

  let { lang, sync, busy, message, onsync }: Props = $props();

  const when = $derived(
    sync.lastSyncedAt
      ? new Date(sync.lastSyncedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        })
      : null,
  );
</script>

<section class="card">
  <div class="head">
    <h2>{t('me.sync', lang)}</h2>
    <span class:ok={sync.pending === 0}>
      {sync.pending === 0
        ? t('me.syncAll', lang)
        : t('me.syncPending', lang, { count: sync.pending })}
    </span>
  </div>
  <p>{when ? t('me.lastSynced', lang, { time: when }) : t('me.never', lang)}</p>
  <button type="button" disabled={busy} onclick={onsync}>{t('me.syncNow', lang)}</button>
  {#if message}
    <p class="result" role="status">{message}</p>
  {/if}
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

  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 16px;
  }

  .head span {
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 600;
  }

  .head span.ok {
    color: var(--color-correct);
  }

  p {
    margin: 0;
    color: var(--color-muted);
    font-size: 14px;
  }

  .result {
    color: var(--color-ink);
  }

  button {
    min-height: 46px;
    border: 1.5px solid var(--color-primary);
    border-radius: 12px;
    background: var(--color-card);
    color: var(--color-primary);
    font-size: 15px;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.6;
  }
</style>

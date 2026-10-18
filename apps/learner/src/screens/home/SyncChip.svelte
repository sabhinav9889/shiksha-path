<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';
  import Icon from '../../ui/Icon.svelte';

  const MS_PER_MINUTE = 60_000;
  const ICON_SIZE = 16;

  let {
    lastSyncedAt,
    pending,
    now,
    lang,
  }: { lastSyncedAt: string | null; pending: number; now: Date; lang: Lang } = $props();

  const saved = $derived(pending === 0 && lastSyncedAt !== null);
  const minutes = $derived(
    lastSyncedAt === null
      ? 0
      : Math.max(0, Math.floor((now.getTime() - new Date(lastSyncedAt).getTime()) / MS_PER_MINUTE)),
  );
</script>

<span class="chip" class:saved>
  <Icon name="check" size={ICON_SIZE} />
  {saved ? t('status.saved', lang, { minutes }) : t('status.savedLater', lang)}
</span>

<style>
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
    font-size: 13px;
    font-weight: 600;
  }

  .chip.saved {
    background: var(--color-correct-bg);
    color: var(--color-correct);
  }
</style>

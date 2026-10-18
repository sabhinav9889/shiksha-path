<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';

  let { lang, onleave, onstay }: { lang: Lang; onleave: () => void; onstay: () => void } = $props();
</script>

<div class="leave" role="alertdialog" aria-label={t('practice.leaveTitle', lang)}>
  <p>{t('practice.leaveTitle', lang)}</p>
  <div class="row">
    <button type="button" class="danger" onclick={onleave}>{t('practice.leave', lang)}</button>
    <button type="button" onclick={onstay}>{t('practice.stay', lang)}</button>
  </div>
</div>

<style>
    .leave {
    position: fixed;
    inset: auto 0 0;
    max-width: 480px;
    margin: 0 auto;
    padding: 20px;
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    background: var(--color-card);
    box-shadow: 0 -4px 24px rgb(0 0 0 / 20%);
  }

  .leave p {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .row button {
    flex: 1;
    min-height: 48px;
    border: 1.5px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-card);
    font-weight: 600;
  }

  .row .danger {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }
</style>

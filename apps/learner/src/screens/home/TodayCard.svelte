<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';
  import Icon from '../../ui/Icon.svelte';

  const ARROW_SIZE = 18;

  interface Props {
    lang: Lang;
    title: string;
    questions: number;
    busy: boolean;
    onstart: () => void;
  }

  let { lang, title, questions, busy, onstart }: Props = $props();
</script>

<section class="card">
  <span class="label">{t('home.today', lang)}</span>
  <h2>{title}</h2>
  <span class="meta">{t('home.questions', lang, { count: questions })}</span>
  <button type="button" disabled={busy} onclick={onstart}>
    {t('action.start', lang)}
    <Icon name="arrow" size={ARROW_SIZE} />
  </button>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
    border-radius: var(--radius-l);
    background: var(--color-primary);
    color: #fff;
  }

  .label {
    color: #d9dcff;
    font-size: 14px;
    font-weight: 600;
  }

  h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 24px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .meta {
    color: #d9dcff;
    font-size: 15px;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    margin-top: 4px;
    border: none;
    border-radius: 14px;
    background: #fff;
    color: var(--color-primary);
    font-size: 17px;
    font-weight: 600;
  }
</style>

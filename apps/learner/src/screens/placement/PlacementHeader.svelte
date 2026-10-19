<script lang="ts">
  import { t, type Lang } from '../../i18n/index.js';

  interface Props {
    lang: Lang;
    trackTitle: string;
    tracks: string[];
    current: string;
    onskip: () => void;
  }

  let { lang, trackTitle, tracks, current, onskip }: Props = $props();
</script>

<header>
  <div class="top">
    <span class="label">{t('placement.title', lang, { track: trackTitle })}</span>
    <button type="button" class="link" onclick={onskip}>{t('placement.skip', lang)}</button>
  </div>
  <div class="segments">
    {#each tracks as id, i (id)}
      <span
        data-testid="segment"
        class:done={i < tracks.indexOf(current)}
        class:now={id === current}
      ></span>
    {/each}
  </div>
</header>

<style>
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .label {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
  }

  .link {
    border: none;
    background: none;
    color: var(--color-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .segments {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 6px;
    margin-top: 10px;
  }

  .segments span {
    height: 6px;
    border-radius: 3px;
    background: var(--color-line);
  }

  .segments span.done,
  .segments span.now {
    background: var(--color-primary);
  }
</style>

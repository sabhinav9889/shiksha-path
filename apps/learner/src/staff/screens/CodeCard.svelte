<script lang="ts">
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';

  /** A new backup code, large, shown once until "हो गया". The page keeps no copy. */
  let { code, lang, ondone }: { code: string; lang: Lang; ondone: () => void } = $props();
</script>

<div class="code">
  <p class="big" data-testid="new-code">{code}</p>
  <p>{st('writeItDown', lang)}</p>
  <button type="button" onclick={ondone}>{st('done', lang)}</button>
</div>

<style>
  .code {
    padding: 16px;
    border-radius: 14px;
    background: var(--color-primary-soft);
  }

  .big {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 3px;
    font-family: monospace;
  }

  button {
    min-height: 44px;
    padding: 0 16px;
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }
</style>

<script lang="ts">
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';

  let { flags, lang }: { flags: ('inactive' | 'stuck' | 'low_scores')[]; lang: Lang } = $props();
</script>

{#each flags as flag (flag)}
  <span class="badge">{st(flag, lang)}</span>
{/each}

<style>
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--color-wrong-bg);
    color: var(--color-wrong);
    font-size: 13px;
    font-weight: 600;
  }
</style>

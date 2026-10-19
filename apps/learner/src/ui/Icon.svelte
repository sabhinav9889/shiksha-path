<script lang="ts">
  import { ICON_PATHS, type IconName } from './icons.js';

  const DEFAULT_SIZE = 22;

  let { name, size = DEFAULT_SIZE }: { name: IconName; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each ICON_PATHS[name] as d (d)}
    <path {d} />
  {/each}
</svg>

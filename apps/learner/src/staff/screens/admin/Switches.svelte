<script lang="ts">
  import { FEATURE_KEYS, type FeatureKey } from '@shiksha/api-contract';
  import { onMount } from 'svelte';
  import type { Lang } from '../../../i18n/index.js';
  import { at, FEATURE_NAMES } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';

  /** Each feature for all students; a student's own setting is on the students page. */
  let { lang }: { lang: Lang } = $props();
  let values = $state<Record<FeatureKey, boolean> | null>(null);
  let saved = $state(false);
  let failed = $state(false);

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.setup();
    if (result?.ok) values = result.value.switches;
    else failed = true;
  }

  async function change(key: FeatureKey, enabledForAll: boolean): Promise<void> {
    saved = false;
    const result = await staffState.auth?.api.setSwitch({ key, enabledForAll });
    failed = !result?.ok;
    saved = !failed;
    await load(); // shows the server's value, also after a failure
  }

  onMount(load);
</script>

<div class="admin">
  <h2>{at('forEveryone', lang)}</h2>
  {#if values}
    {#each FEATURE_KEYS as key (key)}
      <label class="check">
        <input
          type="checkbox"
          checked={values[key]}
          onchange={(e) => change(key, e.currentTarget.checked)}
        />
        {FEATURE_NAMES[key][lang]}
      </label>
    {/each}
  {:else if !failed}
    <p>{st('loading', lang)}</p>
  {/if}
  {#if saved}<p>{st('saved', lang)}</p>{/if}
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
</div>

<script lang="ts">
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import CodeCard from './CodeCard.svelte';

  /** A backup code is shown once, grouped for reading aloud, then forgotten by the page. */
  let { learnerId, hasCode, lang }: { learnerId: string; hasCode: boolean; lang: Lang } = $props();
  let code = $state<string | null>(null);
  let failed = $state(false);
  let issued = $state(false);
  async function make(): Promise<void> {
    failed = false;
    const api = staffState.auth?.api;
    const reset = hasCode || issued;
    const body = { learnerId };
    const result = reset ? await api?.resetCode(body) : await api?.issueCode(body);
    if (!result?.ok) {
      failed = true;
      return;
    }
    issued = true;
    code = result.value.code; // the server sends it grouped: ABCD-EFGH
  }
</script>

{#if code}
  <CodeCard {code} {lang} ondone={() => (code = null)} />
{:else}
  <button type="button" onclick={make}>{st(hasCode || issued ? 'resetCode' : 'issueCode', lang)}</button>
{/if}
{#if failed}<p role="alert">{st('failed', lang)}</p>{/if}

<style>
  button {
    min-height: 44px;
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }
</style>

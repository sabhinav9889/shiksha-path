<script lang="ts">
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';

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
  <div class="code">
    <p class="big" data-testid="new-code">{code}</p>
    <p>{st('writeItDown', lang)}</p>
    <button type="button" onclick={() => (code = null)}>{st('done', lang)}</button>
  </div>
{:else}
  <button type="button" onclick={make}>{st(hasCode || issued ? 'resetCode' : 'issueCode', lang)}</button>
{/if}
{#if failed}<p role="alert">{st('failed', lang)}</p>{/if}

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
    border: none;
    border-radius: 12px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 600;
  }
</style>

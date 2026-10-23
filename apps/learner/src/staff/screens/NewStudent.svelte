<script lang="ts">
  import type { Lang } from '../../i18n/index.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import CodeCard from './CodeCard.svelte';

  /** A student without Google joins this cohort: a name in, a backup code out (once). */
  let { cohortId, lang, onadded }: { cohortId: string; lang: Lang; onadded: () => void } =
    $props();
  let name = $state('');
  let code = $state<string | null>(null);
  let failed = $state(false);

  async function add(event: Event): Promise<void> {
    event.preventDefault();
    failed = false;
    const result = await staffState.auth?.api.issueCode({ name: name.trim(), cohortId });
    if (!result?.ok) {
      failed = true;
      return;
    }
    name = '';
    code = result.value.code;
  }

  function done(): void {
    code = null;
    onadded();
  }
</script>

{#if code}
  <CodeCard {code} {lang} ondone={done} />
{:else}
  <form onsubmit={add}>
    <label>
      {st('newStudentName', lang)}
      <input required maxlength="40" bind:value={name} />
    </label>
    <button type="submit">{st('addStudent', lang)}</button>
  </form>
{/if}
{#if failed}<p role="alert">{st('failed', lang)}</p>{/if}

<style>
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: end;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  input {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--color-line);
    border-radius: 10px;
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

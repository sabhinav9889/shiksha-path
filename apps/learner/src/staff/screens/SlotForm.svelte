<script lang="ts">
  import type { Lang } from '../../i18n/index.js';
  import { bt } from '../booking-i18n.js';
  import { fromLocalInput } from '../post-time.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';

  /** Publish an open slot: a time (India time), a length and a link the mentor pastes. */
  let { lang, onsaved }: { lang: Lang; onsaved: () => Promise<void> } = $props();

  const STEP = 15;
  const LENGTH_COUNT = 8;
  // 15 to 120 minutes, in steps of 15
  const LENGTHS = Array.from({ length: LENGTH_COUNT }, (_, n) => (n + 1) * STEP);
  const DEFAULT_MINUTES = 30;
  let startsAt = $state('');
  let minutes = $state(DEFAULT_MINUTES);
  let link = $state('');
  let failed = $state(false);
  let busy = $state(false);

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return; // a second tap must not publish twice
    busy = true;
    const body = {
      startsAt: fromLocalInput(startsAt),
      minutes: Number(minutes),
      link: link.trim() || null,
    };
    const result = await staffState.auth?.api.publishSlot(body);
    busy = false;
    failed = !result?.ok;
    if (failed) return;
    startsAt = '';
    link = '';
    await onsaved();
  }
</script>

<form onsubmit={submit}>
  <h2>{bt('newSlot', lang)}</h2>
  <p class="muted">{bt('hint', lang)}</p>
  <label>{bt('startsAt', lang)} <input required type="datetime-local" bind:value={startsAt} /></label>
  <label>
    {bt('minutes', lang)}
    <select bind:value={minutes}>
      {#each LENGTHS as length (length)}<option value={length}>{length}</option>{/each}
    </select>
  </label>
  <label>
    {bt('joinLink', lang)}
    <input type="url" maxlength="500" placeholder="https://" bind:value={link} />
  </label>
  <div class="actions">
    <button type="submit" disabled={busy}>{bt('addSlot', lang)}</button>
  </div>
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
</form>

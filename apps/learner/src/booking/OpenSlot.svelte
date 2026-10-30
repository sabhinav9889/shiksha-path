<script lang="ts">
  import type { BookingTopic } from '@shiksha/api-contract';
  import { BOOKING_TOPICS } from '@shiksha/api-contract';
  import { sessionWhen } from '../community/session-time.js';
  import type { Lang } from '../i18n/index.js';
  import { bs } from './booking-i18n.js';
  import { topicWords } from './topic-words.js';

  /** One open slot, and a small form to book it: a topic and an optional short note. */
  let {
    slot,
    lang,
    onbook,
  }: {
    slot: { id: string; mentorName: string; startsAt: string; minutes: number };
    lang: Lang;
    onbook: (slotId: string, topic: BookingTopic, note: string) => Promise<boolean>;
  } = $props();
  const MAX_NOTE = 280;
  let asking = $state(false);
  let topic = $state<BookingTopic>('doubt');
  let note = $state('');
  let busy = $state(false);

  async function confirm(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return; // a second tap must not book twice
    busy = true;
    const done = await onbook(slot.id, topic, note);
    busy = false;
    if (!done) asking = false;
  }
</script>

<li class="slot">
  <div class="line">
    <span>
      <strong>{bs('withMentor', lang, { name: slot.mentorName })}</strong>
      <span class="muted">
        {sessionWhen(slot.startsAt, lang)} · {bs('minutes', lang, { minutes: slot.minutes })}
      </span>
    </span>
    {#if !asking}<button type="button" onclick={() => (asking = true)}>{bs('book', lang)}</button>{/if}
  </div>
  {#if asking}
    <form onsubmit={confirm}>
      <label>
        {bs('topic', lang)}
        <select bind:value={topic}>
          {#each BOOKING_TOPICS as option (option)}
            <option value={option}>{topicWords(option, lang)}</option>
          {/each}
        </select>
      </label>
      <label>
        {bs('note', lang)}
        <textarea rows="3" maxlength={MAX_NOTE} bind:value={note}></textarea>
      </label>
      <div class="actions">
        <button type="submit" disabled={busy}>{bs('confirm', lang)}</button>
        <button type="button" class="quiet" onclick={() => (asking = false)}>{bs('no', lang)}</button>
      </div>
    </form>
  {/if}
</li>

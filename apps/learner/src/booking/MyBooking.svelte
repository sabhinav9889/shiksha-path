<script lang="ts">
  import type { MyBookingsResponse } from '@shiksha/api-contract';
  import { sessionWhen, safeLink, sessionState } from '../community/session-time.js';
  import type { Lang } from '../i18n/index.js';
  import { bs } from './booking-i18n.js';
  import { topicWords } from './topic-words.js';

  /** One of my bookings: the mentor's link as booked, and a cancel that asks first. */
  let {
    booking,
    lang,
    now,
    oncancel,
  }: {
    booking: MyBookingsResponse['bookings'][number];
    lang: Lang;
    now: Date;
    oncancel: (id: string) => Promise<void>;
  } = $props();
  let asking = $state(false);
  let busy = $state(false);

  const link = $derived(safeLink(booking.link));
  const over = $derived(sessionState(booking.startsAt, booking.minutes, now) === 'over');

  async function cancel(): Promise<void> {
    busy = true;
    await oncancel(booking.id);
    busy = false;
    asking = false;
  }
</script>

<li class="slot">
  <div class="line">
    <span>
      <strong>{bs('withMentor', lang, { name: booking.mentorName ?? '' })}</strong>
      <span class="muted">
        {sessionWhen(booking.startsAt, lang)} · {bs('minutes', lang, { minutes: booking.minutes })}
        · {topicWords(booking.topic, lang)}
      </span>
    </span>
    {#if link && !over}
      <a href={link} target="_blank" rel="noopener noreferrer">{bs('join', lang)}</a>
    {/if}
  </div>
  <div class="actions">
    {#if asking}
      <span>{bs('sure', lang)}</span>
      <button type="button" disabled={busy} onclick={cancel}>{bs('yes', lang)}</button>
      <button type="button" class="quiet" disabled={busy} onclick={() => (asking = false)}>
        {bs('no', lang)}
      </button>
    {:else}
      <button type="button" class="quiet" onclick={() => (asking = true)}>
        {bs('cancelBooking', lang)}
      </button>
    {/if}
  </div>
</li>

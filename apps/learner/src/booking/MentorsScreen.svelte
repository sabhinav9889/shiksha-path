<script lang="ts">
  import type { BookingTopic, MyBookingsResponse, OpenSlotsResponse } from '@shiksha/api-contract';
  import { onMount } from 'svelte';
  import { linkedApi } from '../account/account.js';
  import type { ApiClient } from '../api/api-client.js';
  import { appState } from '../app-state.svelte.js';
  import { bs, type BookingKey } from './booking-i18n.js';
  import './booking.css';
  import MyBooking from './MyBooking.svelte';
  import OpenSlot from './OpenSlot.svelte';

  /** Talk to a mentor (spec §10.1): open times of my cohort's mentors, and my own bookings. */
  let open = $state<OpenSlotsResponse['slots'] | null>(null);
  let mine = $state<MyBookingsResponse['bookings'] | null>(null);
  let off = $state(false);
  let message = $state<BookingKey | ''>('');
  const lang = $derived(appState.lang);
  const now = (): Date => appState.runtime?.clock.now() ?? new Date();

  /** What to tell the student when the server refuses. A taken or stale slot reloads the list. */
  const WHY: Record<string, BookingKey> = {
    SLOT_TAKEN: 'taken',
    BOOKING_LIMIT: 'limit',
    INVALID_REQUEST: 'tooSoon',
    FORBIDDEN: 'tooSoon',
    TOO_LATE: 'tooLate',
    FEATURE_OFF: 'off',
  };
  const STALE = ['SLOT_TAKEN', 'INVALID_REQUEST', 'FORBIDDEN'];

  async function client() {
    const { runtime, profile } = appState;
    return runtime && profile ? linkedApi(runtime, profile.id) : null;
  }

  async function load(): Promise<void> {
    const api = await client();
    if (!api) {
      open = open ?? [];
      mine = mine ?? [];
      message = 'failed';
      return;
    }
    const [slots, bookings] = await Promise.all([api.openSlots(), api.myBookings()]);
    if (!slots.ok && slots.error === 'FEATURE_OFF') {
      off = true;
      return;
    }
    show(slots, bookings);
  }

  /** Show what came back; a part that failed keeps what was there before. */
  function show(
    slots: Awaited<ReturnType<ApiClient['openSlots']>>,
    bookings: Awaited<ReturnType<ApiClient['myBookings']>>,
  ): void {
    open = slots.ok ? slots.value.slots : (open ?? []);
    mine = bookings.ok ? bookings.value.bookings : (mine ?? []);
    message = slots.ok && bookings.ok ? '' : 'failed';
  }

  async function settle(error: string): Promise<void> {
    if (STALE.includes(error)) await load(); // a fresh list first, so the reason is not wiped
    message = WHY[error] ?? 'failed';
  }

  async function book(slotId: string, topic: BookingTopic, note: string): Promise<boolean> {
    const result = await (await client())?.bookSlot({ slotId, topic, note });
    if (result?.ok) {
      await load();
      return true;
    }
    await settle(result?.ok === false ? result.error : 'OFFLINE');
    return false;
  }

  async function cancel(id: string): Promise<void> {
    const result = await (await client())?.cancelBooking({ id });
    if (result?.ok) await load();
    else await settle(result?.ok === false ? result.error : 'OFFLINE');
  }

  onMount(load);
</script>

<section class="mentors">
  <h1>{bs('title', lang)}</h1>
  {#if off}
    <p class="note" role="status">{bs('off', lang)}</p>
  {:else}
    <p class="muted">{bs('intro', lang)}</p>
    {#if message}<p class="alert" role="alert">{bs(message, lang)}</p>{/if}
    {#if open === null || mine === null}
      <p>{bs('loading', lang)}</p>
    {:else}
      <section class="panel">
        <h2>{bs('mine', lang)}</h2>
        <ul>
          {#each mine as booking (booking.id)}
            <MyBooking {booking} {lang} now={now()} oncancel={cancel} />
          {:else}
            <li class="muted">{bs('noneMine', lang)}</li>
          {/each}
        </ul>
      </section>
      <section class="panel">
        <h2>{bs('open', lang)}</h2>
        <ul>
          {#each open as slot (slot.id)}
            <OpenSlot {slot} {lang} onbook={book} />
          {:else}
            <li class="muted">{bs('noneOpen', lang)}</li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</section>

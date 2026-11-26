<script lang="ts">
  import type { StaffSlot } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import { topicWords } from '../../booking/topic-words.js';
  import { sessionWhen } from '../../community/session-time.js';
  import type { Lang } from '../../i18n/index.js';
  import { bt } from '../booking-i18n.js';
  import { st } from '../i18n.js';
  import { staffState } from '../staff-state.svelte.js';
  import DeleteGroup from './admin/DeleteGroup.svelte';
  import SlotForm from './SlotForm.svelte';
  import './admin/setup.css';

  /** A mentor's one-to-one slots and who booked them; an admin sees every mentor's. */
  let { lang }: { lang: Lang } = $props();
  let slots = $state<StaffSlot[] | null>(null);
  let failed = $state(false);

  async function load(): Promise<void> {
    const result = await staffState.auth?.api.slots();
    if (result?.ok) slots = result.value.slots;
    else failed = true;
  }

  onMount(load);
</script>

<div class="setup">
  {#if failed}<p role="alert" class="alert">{st('failed', lang)}</p>{/if}
  <section class="panel"><SlotForm {lang} onsaved={load} /></section>
  <section class="panel">
    {#if !slots}
      <p>{st('loading', lang)}</p>
    {:else if slots.length === 0}
      <p class="muted">{bt('noSlots', lang)}</p>
    {:else}
      <ul>
        {#each slots as slot (slot.id)}
          {@const when = sessionWhen(slot.startsAt, lang)}
          <li class="person">
            <span class="who">
              <strong>{when} · {bt('duration', lang, { minutes: slot.minutes })}</strong>
              {#if staffState.me?.role === 'admin' && slot.mentorName}
                <span class="muted">{bt('mentor', lang, { name: slot.mentorName })}</span>
              {/if}
              {#if slot.booking}
                <span>
                  {bt('booked', lang, {
                    name: slot.booking.studentName,
                    topic: topicWords(slot.booking.topic, lang),
                  })}
                </span>
                {#if slot.booking.note}<span class="body">{slot.booking.note}</span>{/if}
              {:else}
                <span class="badge">{bt('open', lang)}</span>
              {/if}
            </span>
            <span class="actions">
              <DeleteGroup kind="slot" id={slot.id} name={when} {lang} ondeleted={load} />
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

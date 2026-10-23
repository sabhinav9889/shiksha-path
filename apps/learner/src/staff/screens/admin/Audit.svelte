<script lang="ts">
  import type { AuditPage } from '@shiksha/api-contract/staff';
  import { onMount } from 'svelte';
  import { routeHref } from '../../../router.svelte.js';
  import type { Lang } from '../../../i18n/index.js';
  import { actionWords, at } from '../../admin-i18n.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';
  import { whenWords } from '../../words.js';

  type Entry = AuditPage['entries'][number];

  /** Who did what, newest first. Entries about a deleted student say so and name nobody. */
  let { lang }: { lang: Lang } = $props();
  let entries = $state<Entry[] | null>(null);
  let next = $state<number | null>(null);
  let staffNames = $state<Record<string, string>>({});
  let failed = $state(false);

  async function load(before?: number): Promise<void> {
    const result = await staffState.auth?.api.audit(before);
    if (!result?.ok) {
      failed = true;
      return;
    }
    entries = before ? [...(entries ?? []), ...result.value.entries] : result.value.entries;
    next = result.value.next;
  }

  onMount(async () => {
    const setup = await staffState.auth?.api.setup();
    if (setup?.ok) staffNames = Object.fromEntries(setup.value.staff.map((s) => [s.id, s.name]));
    await load();
  });
</script>

<div class="admin">
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
  {#if !entries}
    <p>{st('loading', lang)}</p>
  {:else if entries.length === 0}
    <p>{at('noEntries', lang)}</p>
  {:else}
    <ul>
      {#each entries as e (e.id)}
        <li data-testid="audit-row">
          <span class="muted">{whenWords(e.at, lang)}</span>
          <strong>{(e.staffId && staffNames[e.staffId]) || at('someone', lang)}</strong>
          {actionWords(e.action, lang)}
          {#if e.details['learner'] === 'DELETED'}
            · {at('deletedStudent', lang)}
          {:else if e.learnerId}
            · <a href={routeHref({ name: 'staff', view: 'student', id: e.learnerId })}>
              {at('seeStudent', lang)}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
    {#if next}
      <button type="button" onclick={() => load(next ?? undefined)}>{at('more', lang)}</button>
    {/if}
  {/if}
</div>

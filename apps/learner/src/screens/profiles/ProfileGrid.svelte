<script lang="ts">
  import type { Profile } from '@shiksha/learner-core';
  import { COLOURS, TRUNCATE } from './avatar.js';

  interface Props {
    profiles: Profile[];
    selectedId: string | null;
    addLabel: string;
    onchoose: (id: string) => void;
    onadd: () => void;
  }

  let { profiles, selectedId, addLabel, onchoose, onadd }: Props = $props();
</script>

<div class="people">
  {#each profiles as profile, index (profile.id)}
    {@const [bg, ink] = COLOURS[index % COLOURS.length] ?? COLOURS[0] ?? ['', '']}
    <button
      type="button"
      class="person"
      class:selected={profile.id === selectedId}
      aria-pressed={profile.id === selectedId}
      onclick={() => onchoose(profile.id)}
    >
      <span class="avatar" aria-hidden="true" style:background={bg} style:color={ink}>
        {[...profile.name][0]}
      </span>
      <span
        class="name"
        data-testid="profile-name"
        style={TRUNCATE}
      >
        {profile.name}
      </span>
    </button>
  {/each}
  <button type="button" class="person add" onclick={onadd}>
    {addLabel}
  </button>
</div>

<style>
  .people {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .person {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 110px;
    min-width: 0;
    padding: 6px;
    border: 2px solid var(--color-card);
    border-radius: var(--radius-m);
    background: var(--color-card);
    color: var(--color-ink);
    font-size: 15px;
    font-weight: 600;
  }

  .person.selected {
    border-color: var(--color-primary);
  }

  .person.add {
    border: 2px dashed #c9cde0;
    background: none;
    color: var(--color-primary);
    font-size: 14px;
  }

  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    font-size: 18px;
    font-weight: 600;
  }
</style>

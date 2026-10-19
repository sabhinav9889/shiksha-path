<script lang="ts">
  import { onMount } from 'svelte';
  import { CoreError, type Profile } from '@shiksha/learner-core';
  import { appState, signIn, signOut } from '../../app-state.svelte.js';
  import { errorMessage, t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import CreateProfile from './CreateProfile.svelte';
  import { COLOURS, TRUNCATE } from './avatar.js';
  import PinPad from './PinPad.svelte';

  const MS_PER_SECOND = 1000;
  const LONGEST_LOCK_SECONDS = 900;

  let profiles = $state<Profile[] | null>(null);
  let selectedId = $state<string | null>(null);
  let creating = $state(false);
  let error = $state('');
  let lockSeconds = $state(0);
  let busy = $state(false);

  const lang = $derived(appState.lang);
  const selected = $derived(profiles?.find((p) => p.id === selectedId) ?? null);
  const locked = $derived(lockSeconds > 0);

  onMount(async () => {
    signOut(); // opening the picker is how a learner switches: nobody stays signed in
    profiles = (await appState.runtime?.profiles.list()) ?? [];
    selectedId = profiles[0]?.id ?? null;
  });

  /** A lock saved with the profile (set before a restart) shows its remaining time at once. */
  $effect(() => {
    const until = selected?.lockedUntil;
    const now = appState.runtime?.clock.now().getTime() ?? 0;
    const seconds = until ? Math.ceil((new Date(until).getTime() - now) / MS_PER_SECOND) : 0;
    lockSeconds = seconds > 0 && seconds <= LONGEST_LOCK_SECONDS ? seconds : 0;
  });

  $effect(() => {
    if (!locked) return;
    const timer = setInterval(() => {
      lockSeconds -= 1;
      if (lockSeconds <= 0) error = '';
    }, MS_PER_SECOND);
    return () => clearInterval(timer);
  });

  function choose(id: string): void {
    selectedId = id;
    error = '';
  }

  async function submit(pin: string): Promise<void> {
    if (!selectedId || busy) return;
    busy = true;
    error = '';
    try {
      await signIn(selectedId, pin);
      navigate({ name: 'home' });
    } catch (failure) {
      if (!(failure instanceof CoreError)) error = t('profiles.generalError', lang);
      else if (failure.code === 'PIN_LOCKED') {
        lockSeconds = Number(failure.details?.retryAfterSec ?? 0);
      }
      else error = errorMessage(failure.code, lang, failure.details);
      // the attempt changed the stored profile (attempts, lock): read it again so switching
      // to another profile and back still shows the lock
      profiles = (await appState.runtime?.profiles.list()) ?? profiles;
    } finally {
      busy = false;
    }
  }
</script>

{#if profiles === null}
  <div data-testid="profiles-loading"></div>
{:else if profiles.length === 0 || creating}
  <CreateProfile
    {lang}
    existingCount={profiles.length}
    oncancel={profiles.length > 0 ? () => (creating = false) : undefined}
  />
{:else}
  <section class="picker">
    <header>
      <h1>{t('profiles.title', lang)}</h1>
      <p>{t('profiles.count', lang, { count: profiles.length })}</p>
    </header>

    <div class="people">
      {#each profiles as profile, index (profile.id)}
        {@const [bg, ink] = COLOURS[index % COLOURS.length] ?? COLOURS[0] ?? ['', '']}
        <button
          type="button"
          class="person"
          class:selected={profile.id === selectedId}
          aria-pressed={profile.id === selectedId}
          onclick={() => choose(profile.id)}
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
      <button type="button" class="person add" onclick={() => (creating = true)}>
        {t('profiles.add', lang)}
      </button>
    </div>

    {#if selected}
      <div class="card">
        <p class="prompt">{t('pin.prompt', lang, { name: selected.name })}</p>
        <PinPad
          {lang}
          disabled={locked || busy}
          error={locked ? errorMessage('PIN_LOCKED', lang, { retryAfterSec: lockSeconds }) : error}
          onsubmit={submit}
        />
        <p class="note">{t('pin.note', lang)}</p>
      </div>
    {/if}
  </section>
{/if}

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 28px 20px 24px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 28px;
    line-height: 1.15;
  }

  header p {
    margin: 4px 0 0;
    color: var(--color-muted);
    font-size: 15px;
  }

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

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border-radius: var(--radius-l);
    background: var(--color-card);
  }

  .prompt {
    margin: 0;
    max-width: 100%;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    overflow-wrap: anywhere; /* a long name has no spaces to break at */
  }

  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: 12px;
    text-align: center;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { CoreError, type Profile } from '@shiksha/learner-core';
  import { appState, signIn, signOut } from '../../app-state.svelte.js';
  import { errorMessage, t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import { visibleProfiles } from '../../account/account.js';
  import { takeWipedNotice } from '../../account/forget.js';
  import { profilesChanged } from '../../account/profiles-changed.svelte.js';
  import RestoreButton from '../account/RestoreButton.svelte';
  import RestoreProfile from '../account/RestoreProfile.svelte';
  import CreateProfile from './CreateProfile.svelte';
  import PinPad from './PinPad.svelte';
  import ProfileGrid from './ProfileGrid.svelte';

  const MS_PER_SECOND = 1000;
  const LONGEST_LOCK_SECONDS = 900;

  let profiles = $state<Profile[] | null>(null);
  let selectedId = $state<string | null>(null);
  let creating = $state(false);
  let restoring = $state(false);
  /** A profile was wiped because the NGO deleted it: said once, here. */
  let wipedNotice = $state(false);
  let error = $state('');
  let lockSeconds = $state(0);
  let busy = $state(false);

  const lang = $derived(appState.lang);
  const selected = $derived(profiles?.find((p) => p.id === selectedId) ?? null);
  const locked = $derived(lockSeconds > 0);

  onMount(() => {
    signOut(); // opening the picker is how a learner switches: nobody stays signed in
  });

  /** Load the list now, and again whenever a sign-in changed the phone's profiles. */
  $effect(() => {
    void profilesChanged.count;
    creating = false;
    restoring = false;
    const runtime = appState.runtime;
    void (runtime ? visibleProfiles(runtime) : Promise.resolve([])).then((list) => {
      profiles = list;
      selectedId = list[0]?.id ?? null;
    });
    if (runtime) void takeWipedNotice(runtime).then((shown) => (wipedNotice = shown));
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

{#if wipedNotice}
  <p class="notice" role="status">{t('account.wiped', lang)}</p>
{/if}
{#if profiles === null}
  <div data-testid="profiles-loading"></div>
{:else if restoring}
  <RestoreProfile {lang} oncancel={() => (restoring = false)} />
{:else if profiles.length === 0 || creating}
  <CreateProfile
    {lang}
    existingCount={profiles.length}
    oncancel={profiles.length > 0 ? () => (creating = false) : undefined}
  />
  <RestoreButton {lang} onrestore={() => (restoring = true)} />
  <a class="staff-link" href="#/staff">{t('profiles.staff', lang)}</a>
{:else}
  <section class="picker">
    <header>
      <h1>{t('profiles.title', lang)}</h1>
      <p>{t('profiles.count', lang, { count: profiles.length })}</p>
    </header>

    <ProfileGrid
      {profiles}
      {selectedId}
      addLabel={t('profiles.add', lang)}
      onchoose={choose}
      onadd={() => (creating = true)}
    />
    <RestoreButton {lang} onrestore={() => (restoring = true)} />
    <a class="staff-link" href="#/staff">{t('profiles.staff', lang)}</a>

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
  .staff-link {
    display: block;
    margin: 16px auto;
    padding: 12px;
    color: var(--color-muted);
    font-size: 14px;
    text-align: center;
  }

  .notice {
    max-width: 640px;
    margin: 12px auto 0;
    padding: 12px 16px;
    border-radius: var(--radius-m);
    background: var(--color-card);
    font-weight: 600;
  }

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

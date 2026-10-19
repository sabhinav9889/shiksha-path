<script lang="ts">
  import { onMount } from 'svelte';
  import type { LanguagePreference } from '@shiksha/learner-core';
  import { appState, refreshSession, setLanguagePreference, signOut } from '../../app-state.svelte.js';
  import { errorMessage, t } from '../../i18n/index.js';
  import { navigate } from '../../router.svelte.js';
  import { install } from '../../runtime/install-prompt.js';
  import { browserStorageEstimator } from '../../storage/estimator.js';
  import { loadMe, type MeData } from './me-data.js';
  import StorageCard from './StorageCard.svelte';
  import SyncCard from './SyncCard.svelte';

  type Choice = { id: LanguagePreference; label: string; sub: 'me.langHiEnSub' | 'me.langEnSub' };
  const LANGUAGES: Choice[] = [
    { id: 'hi_en', label: 'हिंदी + English', sub: 'me.langHiEnSub' },
    { id: 'en_only', label: 'English only', sub: 'me.langEnSub' },
  ];

  let data = $state<MeData | null>(null);
  let busy = $state(false);
  let message = $state('');
  let canInstall = $state(install.prompt?.available() ?? false);

  const lang = $derived(appState.lang);
  const name = $derived(appState.profile?.name ?? '');

  async function load(): Promise<void> {
    const { runtime, profile, session } = appState;
    if (!runtime || !profile) return;
    data = await loadMe(runtime, profile.id, session, browserStorageEstimator());
  }

  onMount(() => {
    void load();
    return install.prompt?.subscribe(() => (canInstall = install.prompt?.available() ?? false));
  });

  async function choose(preference: LanguagePreference): Promise<void> {
    await setLanguagePreference(preference);
    await load();
  }

  async function syncNow(): Promise<void> {
    const { runtime, profile } = appState;
    if (!runtime || !profile || busy) return;
    busy = true;
    message = '';
    const result = await runtime.content.sync();
    const upload = await runtime.flush(profile.id);
    if (!result.ok) message = errorMessage(result.error, lang);
    else message = upload.ok ? t('me.syncDone', lang) : t('status.savedLater', lang);
    await refreshSession();
    await load();
    busy = false;
  }

  /** Nobody stays signed in: the picker is the only place left, and Back cannot return. */
  function leave(): void {
    signOut();
    navigate({ name: 'profiles' });
  }
</script>

<section class="me">
  <header>
    <span class="avatar" aria-hidden="true">{[...name][0] ?? ''}</span>
    <h1>{name}</h1>
  </header>

  {#if data}
    <section class="card">
      <h2>{t('me.language', lang)}</h2>
      <div class="choices">
        {#each LANGUAGES as choice (choice.id)}
          <button
            type="button"
            aria-pressed={data.language === choice.id}
            class:selected={data.language === choice.id}
            onclick={() => choose(choice.id)}
          >
            <strong>{choice.label}</strong>
            <span>{t(choice.sub, lang)}</span>
          </button>
        {/each}
      </div>
    </section>

    <SyncCard {lang} sync={data.sync} {busy} {message} onsync={syncNow} />
    <StorageCard {lang} {data} />
  {/if}

  <section class="card links">
    {#if canInstall}
      <button type="button" onclick={() => void install.prompt?.prompt()}>
        {t('me.install', lang)}
      </button>
    {/if}
    <button type="button" onclick={leave}>{t('me.switch', lang)}</button>
    <button type="button" class="danger" onclick={leave}>{t('me.signOut', lang)}</button>
    <p>{t('me.signOutNote', lang)}</p>
  </section>
</section>

<style>
  .me {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 16px;
  }

  header {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }

  .avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #d9dcff;
    color: var(--color-primary-dark);
    font-size: 20px;
    font-weight: 600;
  }

  h1 {
    margin: 0;
    min-width: 0;
    font-family: var(--font-heading);
    font-size: 24px;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-m);
    background: var(--color-card);
  }

  h2 {
    margin: 0;
    font-size: 16px;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .choices button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 64px;
    padding: 8px 12px;
    border: 2px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-card);
    color: var(--color-ink);
    text-align: left;
  }

  .choices button.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  .choices span {
    font-size: 12px;
  }

  .links button {
    min-height: 52px;
    border: none;
    border-bottom: 1px solid var(--color-line);
    background: none;
    color: var(--color-ink);
    font-size: 15px;
    text-align: left;
  }

  .links .danger {
    color: var(--color-wrong);
  }

  .links p {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>

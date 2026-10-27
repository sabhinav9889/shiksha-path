<script lang="ts">
  import { contrastRatio, isReadable, PAGE_BACKGROUND } from '@shiksha/api-contract';
  import { appState, reloadBranding } from '../../../app-state.svelte.js';
  import type { Lang } from '../../../i18n/index.js';
  import { at, type AdminKey } from '../../admin-i18n.js';
  import { refreshBranding } from '../../../runtime/branding.js';
  import { st } from '../../i18n.js';
  import { staffState } from '../../staff-state.svelte.js';

  /** The organisation's name and two colours; refused unless readable on white and the page. */
  let { lang }: { lang: Lang } = $props();
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const DIGITS = 1;
  const form = $state({
    hi: appState.brand.name.hi,
    en: appState.brand.name.en,
    primary: appState.brand.primary,
    accent: appState.brand.accent,
  });
  let saved = $state(false);
  let failed = $state(false);

  const okColour = (c: string): boolean => HEX.test(c) && isReadable(c);
  const canSave = $derived(
    okColour(form.primary) && okColour(form.accent) && form.hi.trim() !== '' && form.en.trim() !== '',
  );

  function contrast(c: string): string {
    if (!HEX.test(c)) return '—';
    return at('contrast', lang, {
      white: contrastRatio('#ffffff', c).toFixed(DIGITS),
      page: contrastRatio(PAGE_BACKGROUND, c).toFixed(DIGITS),
    });
  }

  async function save(event: Event): Promise<void> {
    event.preventDefault();
    saved = false;
    const body = {
      name: { hi: form.hi.trim(), en: form.en.trim() },
      primary: form.primary,
      accent: form.accent,
    };
    const result = await staffState.auth?.api.setBranding(body);
    failed = !result?.ok;
    saved = !failed;
    // Show it in this app now: phones pick it up on their own at their next sync.
    if (saved && appState.runtime) {
      await refreshBranding(appState.runtime);
      await reloadBranding();
    }
  }

  const colours: { key: 'primary' | 'accent'; label: AdminKey }[] = [
    { key: 'primary', label: 'primary' },
    { key: 'accent', label: 'accent' },
  ];
</script>

<form class="admin" onsubmit={save}>
  <label>{at('nameHi', lang)} <input required maxlength="40" bind:value={form.hi} /></label>
  <label>{at('nameEn', lang)} <input required maxlength="40" bind:value={form.en} /></label>
  {#each colours as c (c.key)}
    <div class="row">
      <label>{at(c.label, lang)} <input maxlength="7" bind:value={form[c.key]} /></label>
      <span class="swatch" style:background={HEX.test(form[c.key]) ? form[c.key] : 'transparent'}
      ></span>
      <span class="muted">{contrast(form[c.key])}</span>
      {#if !okColour(form[c.key])}<strong role="status">{at('hardToRead', lang)}</strong>{/if}
    </div>
  {/each}
  <button type="submit" disabled={!canSave}>{at('saveBranding', lang)}</button>
  {#if saved}<p>{at('brandingSaved', lang)}</p>{/if}
  {#if failed}<p role="alert">{st('failed', lang)}</p>{/if}
</form>

<style>
  .swatch {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--color-line);
  }
</style>

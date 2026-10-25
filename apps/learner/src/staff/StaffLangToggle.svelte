<script lang="ts">
  import { setStaffLang, staffLang } from './staff-lang.svelte.js';
  import { st } from './i18n.js';

  /** Shows the other language's name, in its own script, and switches to it. */
  const other = $derived(staffLang.lang === 'hi' ? 'en' : 'hi');
</script>

<button
  type="button"
  class="lang"
  title={st('language', staffLang.lang)}
  lang={other}
  onclick={() => setStaffLang(other)}
>
  {st(other === 'en' ? 'langEnglish' : 'langHindi', staffLang.lang)}
</button>

<style>
  .lang {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--color-line);
    border-radius: 12px;
    background: var(--color-card);
    color: var(--color-ink);
    font-weight: 600;
  }
</style>

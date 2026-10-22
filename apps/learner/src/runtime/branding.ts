import { branding, DEFAULT_BRANDING, type Branding } from '@shiksha/api-contract';
import type { Lang } from '../i18n/index.js';
import type { Runtime } from './runtime.js';

const BRANDING_KEY = 'branding';

/** The phone's last known branding (one for the whole phone); the default until the server says. */
export async function loadBranding(runtime: Runtime): Promise<Branding> {
  const raw = await runtime.events.getMeta(BRANDING_KEY);
  if (!raw) return structuredClone(DEFAULT_BRANDING);
  try {
    const parsed = branding.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : structuredClone(DEFAULT_BRANDING);
  } catch {
    return structuredClone(DEFAULT_BRANDING);
  }
}

/** Ask the server for the branding (no sign-in needed) and keep it; any failure keeps the cache. */
export async function refreshBranding(runtime: Runtime): Promise<void> {
  try {
    const client = runtime.account?.makeApi(() => Promise.resolve(null));
    const answer = await client?.branding();
    if (answer?.ok) await runtime.events.setMeta(BRANDING_KEY, JSON.stringify(answer.value));
  } catch {
    // offline or no backend: the phone keeps what it had
  }
}

/** Put the colours on the page and the name in the tab. Fonts and layout never change. */
export function applyBranding(brand: Branding, doc: Document, lang: Lang): void {
  doc.documentElement.style.setProperty('--color-primary', brand.primary);
  doc.documentElement.style.setProperty('--color-accent', brand.accent);
  doc.title = brand.name[lang];
}

import type { Lang } from '../i18n/index.js';

const MS_PER_MINUTE = 60_000;

/** A session's start on India time, so a mentor and a student read the same clock. */
export function sessionWhen(startsAt: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(startsAt));
}

export type SessionState = 'upcoming' | 'live' | 'over';

/** Worked out from the clock when shown, never stored. */
export function sessionState(startsAt: string, minutes: number, now: Date): SessionState {
  const start = new Date(startsAt).getTime();
  if (now.getTime() < start) return 'upcoming';
  return now.getTime() < start + minutes * MS_PER_MINUTE ? 'live' : 'over';
}

/** The day a post was written, on India time. */
export function postDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

/** Only `https:` links are links; anything else in a stored post is shown as plain text. */
export function safeLink(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link).protocol === 'https:' ? link : null;
  } catch {
    return null;
  }
}

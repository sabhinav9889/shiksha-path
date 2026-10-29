const MS_PER_MINUTE = 60_000;

/** `2026-11-10T10:30:00.000Z` as Google's `20261110T103000Z`. */
const basic = (date: Date): string => date.toISOString().replace(/[-:]|\.\d{3}/g, '');

/**
 * A Google Calendar "new event" link for a session: the phone's own Calendar opens with the
 * details filled in. It needs no sign-in scope and sends nothing to our server.
 */
export function calendarLink(session: {
  title: string;
  startsAt: string;
  minutes: number;
  joinLink: string | null;
}): string {
  const start = new Date(session.startsAt);
  const end = new Date(start.getTime() + session.minutes * MS_PER_MINUTE);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.title,
    dates: `${basic(start)}/${basic(end)}`,
  });
  if (session.joinLink) params.set('details', session.joinLink);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

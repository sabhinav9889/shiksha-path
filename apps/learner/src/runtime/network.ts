/** The Network Information API, where the browser has it (Chrome on Android does). */
type WithConnection = Navigator & { connection?: { type?: string } };

const UNMETERED = new Set(['wifi', 'ethernet']);

/**
 * True only when the browser says the phone is on Wi-Fi or a cable: recordings never use mobile
 * data on their own (Plan 3b). A browser that cannot tell counts as mobile data.
 */
export function onUnmeteredNetwork(nav: Navigator = navigator): boolean {
  const type = (nav as WithConnection).connection?.type;
  return type !== undefined && UNMETERED.has(type);
}

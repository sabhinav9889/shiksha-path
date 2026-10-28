interface AutoSyncDeps {
  content: { sync(): Promise<unknown> };
  flush: () => Promise<unknown>;
  /** Not tied to a profile, so the picker screen gets the new look too. */
  branding: () => Promise<unknown>;
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

/** Sync lessons, upload events and check the branding now and whenever the phone is back online. */
export function startAutoSync({ content, flush, branding, target }: AutoSyncDeps): () => void {
  const run = (): void => {
    content.sync().catch(() => undefined); // failures are reported by the screens that care
    flush().catch(() => undefined);
    branding().catch(() => undefined);
  };
  target.addEventListener('online', run);
  run();
  return () => target.removeEventListener('online', run);
}

interface AutoSyncDeps {
  content: { sync(): Promise<unknown> };
  flush: () => Promise<unknown>;
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

/** Sync lessons and upload events once now and whenever the phone comes back online. */
export function startAutoSync({ content, flush, target }: AutoSyncDeps): () => void {
  const run = (): void => {
    content.sync().catch(() => undefined); // failures are reported by the screens that care
    flush().catch(() => undefined);
  };
  target.addEventListener('online', run);
  run();
  return () => target.removeEventListener('online', run);
}

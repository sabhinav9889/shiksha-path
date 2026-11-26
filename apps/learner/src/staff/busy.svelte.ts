/**
 * One in-flight action at a time. While `work` runs, `busy` is true (the button shows a spinner
 * and is disabled) and a second call is ignored, so a double tap never sends the request twice.
 */
export function createBusy(): {
  readonly busy: boolean;
  run: <T>(work: () => Promise<T>) => Promise<T | undefined>;
} {
  let busy = $state(false);
  return {
    get busy() {
      return busy;
    },
    async run<T>(work: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await work();
      } finally {
        busy = false;
      }
    },
  };
}

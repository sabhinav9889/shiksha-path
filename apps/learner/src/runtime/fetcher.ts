import type { Fetcher } from '@shiksha/learner-core';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The core's `Fetcher` over `fetch`: Range requests, revalidation (`no-cache`, so a new manifest
 * is never hidden by the HTTP cache), and a timeout so a stalled connection cannot hang a sync.
 */
export function createFetcher(
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
  opts: { timeoutMs?: number } = {},
): Fetcher {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async get(url, range) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers: Record<string, string> = range
          ? { Range: `bytes=${range.from}-${range.to}` }
          : {};
        const response = await fetchFn(url, {
          headers,
          cache: 'no-cache',
          signal: controller.signal,
        });
        return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

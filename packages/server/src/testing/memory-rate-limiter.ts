import type { RateLimiter } from '../ports.js';

const MS_PER_SECOND = 1000;

/** Fixed windows in memory, for tests; `now` is injectable to cross a window boundary. */
export function memoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number>();
  return {
    hit(bucket, limit, windowSeconds) {
      const windowMs = windowSeconds * MS_PER_SECOND;
      const key = `${bucket}@${Math.floor(now() / windowMs)}`;
      const count = (hits.get(key) ?? 0) + 1;
      hits.set(key, count);
      return Promise.resolve(count <= limit);
    },
  };
}

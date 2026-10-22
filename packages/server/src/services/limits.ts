import type { RateLimiter } from '../ports.js';
import { ApiFailure } from './failure.js';

/* eslint-disable no-magic-numbers -- the limits table is the named constant (Plan 3b) */
/** How often each action may happen per bucket, enforced on the server (security rule). */
export const LIMITS = {
  code: { limit: 10, windowSeconds: 15 * 60 },
  codeAll: { limit: 300, windowSeconds: 60 * 60 },
  push: { limit: 60, windowSeconds: 60 },
  pull: { limit: 60, windowSeconds: 60 },
  link: { limit: 10, windowSeconds: 60 * 60 },
  recording: { limit: 100, windowSeconds: 24 * 60 * 60 },
  deletedCheck: { limit: 30, windowSeconds: 60 * 60 },
} as const;
/* eslint-enable no-magic-numbers -- end of the limits table */

export type LimitKind = keyof typeof LIMITS;

/** Refuse if the bucket is already at its limit, without counting this request. */
export async function refuseIfFull(
  limiter: RateLimiter,
  kind: LimitKind,
  bucket: string,
): Promise<void> {
  const { limit, windowSeconds } = LIMITS[kind];
  if ((await limiter.count(bucket, windowSeconds)) >= limit) throw new ApiFailure('RATE_LIMITED');
}

/** Count one action in `bucket`; past the limit it is refused as `RATE_LIMITED`. */
export async function enforce(
  limiter: RateLimiter,
  kind: LimitKind,
  bucket: string,
): Promise<void> {
  const { limit, windowSeconds } = LIMITS[kind];
  if (!(await limiter.hit(bucket, limit, windowSeconds))) throw new ApiFailure('RATE_LIMITED');
}

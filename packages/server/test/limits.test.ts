import { describe, expect, test } from 'vitest';
import { clientKey } from '../src/http/client-key.js';
import { LIMITS } from '../src/services/limits.js';
import { memoryRateLimiter } from '../src/testing/memory-rate-limiter.js';

describe('the limits', () => {
  test('match the plan', () => {
    expect(LIMITS).toEqual({
      code: { limit: 10, windowSeconds: 900 },
      codeAll: { limit: 300, windowSeconds: 3600 },
      push: { limit: 60, windowSeconds: 60 },
      pull: { limit: 60, windowSeconds: 60 },
      link: { limit: 10, windowSeconds: 3600 },
      recording: { limit: 100, windowSeconds: 86_400 },
      deletedCheck: { limit: 30, windowSeconds: 3600 },
    });
  });
});

describe('the memory rate limiter', () => {
  test('a new window starts the count again', async () => {
    let now = Date.parse('2026-10-22T10:00:00Z');
    const limiter = memoryRateLimiter(() => now);
    expect(await limiter.hit('x', 1, 60)).toBe(true);
    expect(await limiter.hit('x', 1, 60)).toBe(false);
    now += 60_000;
    expect(await limiter.hit('x', 1, 60)).toBe(true);
  });
});

describe('the client key', () => {
  const request = (forwarded: string) =>
    new Request('https://x/v1', { headers: { 'x-forwarded-for': forwarded } });

  test('is a short hash of the proxy-added (last) forwarded address, never the address', async () => {
    const key = await clientKey(
      request('10.0.0.1, 203.0.113.7'),
      'pepper-pepper-pepper-pepper-32b',
    );
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(key).toBe(await clientKey(request('203.0.113.7'), 'pepper-pepper-pepper-pepper-32b'));
    expect(key).not.toBe(
      await clientKey(request('203.0.113.8'), 'pepper-pepper-pepper-pepper-32b'),
    );
    expect(key).not.toContain('203');
  });

  test('a forged entry on the left is ignored: the key follows the address the proxy added', async () => {
    const pepper = 'pepper-pepper-pepper-pepper-32b';
    const real = await clientKey(request('203.0.113.7'), pepper);
    expect(await clientKey(request('1.2.3.4, 203.0.113.7'), pepper)).toBe(real);
    expect(await clientKey(request('5.6.7.8, 203.0.113.7'), pepper)).toBe(real);
  });

  test('a different pepper gives a different key', async () => {
    const one = await clientKey(request('203.0.113.7'), 'pepper-pepper-pepper-pepper-32b');
    const two = await clientKey(request('203.0.113.7'), 'other-other-other-other-other-32');
    expect(one).not.toBe(two);
  });
});

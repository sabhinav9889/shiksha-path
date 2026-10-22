import { describe, expect, test } from 'vitest';
import { CODE_ALPHABET, newCode, normaliseCode } from '../src/codes/code-format.js';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { memoryLogger } from '../src/logger.js';
import { issueCode } from '../src/services/codes.js';
import { describeCodeContract } from '../src/testing/code-contract.js';
import { makeMemoryCodeFixture } from '../src/testing/memory-auth.js';

describe('the code format', () => {
  test('8 characters with no look-alikes, shown as two groups of four', () => {
    expect(CODE_ALPHABET).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    let i = 0;
    const counting = (n: number): Uint8Array => Uint8Array.from({ length: n }, () => i++);
    expect(newCode(counting)).toBe('ABCD-EFGH');
  });

  test('random bytes that would bias the alphabet are thrown away', () => {
    const bytes = [255, 248, 0, 1, 2, 3, 4, 5, 6, 7];
    const random = (n: number): Uint8Array => Uint8Array.from(bytes.splice(0, n));
    expect(newCode(random)).toBe('ABCD-EFGH');
  });

  test('input ignores case, spaces and dashes; anything else is not a code', () => {
    expect(normaliseCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normaliseCode('ABCD EFGH')).toBe('ABCDEFGH');
    for (const bad of [
      'ABCD-EFG0',
      'ABCD-EFGO',
      'ABCD-EFG1',
      'ABCD-EFGI',
      'ABCD-EFGL',
      'ABCDEFG',
      '',
    ]) {
      expect(normaliseCode(bad)).toBeNull();
    }
  });
});

describeCodeContract('memory', () => Promise.resolve(makeMemoryCodeFixture()));

describe('POST /v1/auth/code', () => {
  test('needs no sign-in, and never logs the code', async () => {
    const fixture = makeMemoryCodeFixture();
    const { code } = await issueCode(fixture.deps, { name: 'A' });
    const logger = memoryLogger();
    const deps = { ...fixture.deps, allowedOrigins: [], logger } as unknown as HandlerDeps;
    const request = new Request('https://x/functions/v1/api/v1/auth/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ code }),
    });
    const res = await handle(request, deps);
    expect(res.status).toBe(200);
    expect(Object.keys((await res.json()) as object).sort()).toEqual([
      'accessToken',
      'expiresAt',
      'refreshToken',
    ]);
    const wrong = await handle(
      new Request('https://x/v1/auth/code', {
        method: 'POST',
        body: JSON.stringify({ code: 'ABCD-EFGH' }),
      }),
      deps,
    );
    expect(wrong.status).toBe(401);
    const logged = JSON.stringify(logger.entries);
    expect(logged).not.toContain(code);
    expect(logged).not.toContain(code.replace('-', ''));
    expect(logged).not.toContain('203.0.113.9');
  });
});

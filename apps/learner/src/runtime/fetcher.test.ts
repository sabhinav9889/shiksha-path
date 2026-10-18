import { afterEach, describe, expect, test, vi } from 'vitest';
import { createFetcher } from './fetcher.js';

afterEach(() => {
  vi.useRealTimers();
});

const reply = (status: number, bytes: number[]): Response =>
  new Response(Uint8Array.from(bytes), { status });

describe('createFetcher', () => {
  test('sends the Range header, revalidates, and maps 206 with its bytes', async () => {
    let seen: RequestInit | undefined;
    const fetchFn = (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      seen = init;
      return Promise.resolve(reply(206, [1, 2, 3]));
    };
    const result = await createFetcher(fetchFn).get('https://c.example/a.mp3', { from: 0, to: 2 });
    expect(result).toEqual({ status: 206, bytes: Uint8Array.of(1, 2, 3) });
    expect(new Headers(seen?.headers).get('Range')).toBe('bytes=0-2');
    expect(seen?.cache).toBe('no-cache');
  });

  test('a full request sends no Range and maps 200', async () => {
    let seen: RequestInit | undefined;
    const fetchFn = (_u: string | URL | Request, init?: RequestInit): Promise<Response> => {
      seen = init;
      return Promise.resolve(reply(200, [9]));
    };
    const result = await createFetcher(fetchFn).get('https://c.example/manifest.json');
    expect(result.status).toBe(200);
    expect(new Headers(seen?.headers).has('Range')).toBe(false);
  });

  test('passes other statuses through instead of throwing', async () => {
    const fetchFn = (): Promise<Response> => Promise.resolve(reply(404, []));
    expect((await createFetcher(fetchFn).get('https://c.example/x')).status).toBe(404);
  });

  test('rejects when the network fails', async () => {
    const fetchFn = (): Promise<Response> => Promise.reject(new TypeError('offline'));
    await expect(createFetcher(fetchFn).get('https://c.example/x')).rejects.toThrow('offline');
  });

  test('aborts and rejects when the server never answers within the timeout', async () => {
    vi.useFakeTimers();
    const fetchFn = (_u: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const pending = createFetcher(fetchFn, { timeoutMs: 5000 }).get('https://c.example/x');
    const outcome = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(5000);
    await outcome;
  });
});

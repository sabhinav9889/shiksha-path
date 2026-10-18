import type { Fetcher } from '../download.js';

export interface ScriptOptions {
  /** Reject the Nth request (1-based). */
  failOnRequest?: number;
  /** Answer a ranged request with the whole file and status 200. */
  ignoreRange?: boolean;
  /** Append this many extra bytes to every body. */
  extraBytes?: number;
  /** Flip the first byte of every body. */
  corrupt?: boolean;
  /** Answer ranged requests with an empty 206. */
  emptyChunks?: boolean;
}

export type Request = { url: string; range?: { from: number; to: number } };

const HTTP_OK = 200;
const HTTP_PARTIAL = 206;
const HTTP_NOT_FOUND = 404;

/** A fake server over in-memory files that can misbehave on request. Unknown urls answer 404. */
export function scriptedFetcher(
  files: Record<string, Uint8Array>,
  opts: ScriptOptions = {},
): Fetcher & { requests: Request[] } {
  const requests: Request[] = [];
  const tweak = (bytes: Uint8Array): Uint8Array => {
    const out = new Uint8Array(bytes.length + (opts.extraBytes ?? 0));
    out.set(bytes);
    if (opts.corrupt && out.length > 0) out[0] = (out[0] ?? 0) ^ 1;
    return out;
  };
  return {
    requests,
    get(url, range) {
      requests.push(range ? { url, range } : { url });
      const file = files[url];
      if (opts.failOnRequest === requests.length) return Promise.reject(new Error('network down'));
      if (!file) return Promise.resolve({ status: HTTP_NOT_FOUND, bytes: new Uint8Array() });
      if (!range || opts.ignoreRange)
        return Promise.resolve({ status: HTTP_OK, bytes: tweak(file) });
      if (opts.emptyChunks)
        return Promise.resolve({ status: HTTP_PARTIAL, bytes: new Uint8Array() });
      const slice = file.slice(range.from, range.to + 1);
      return Promise.resolve({ status: HTTP_PARTIAL, bytes: tweak(slice) });
    },
  };
}

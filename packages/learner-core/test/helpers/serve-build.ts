import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Fetcher } from '../../src/download.js';

export const BASE_URL = 'https://content.example/v1';

export type Request = { url: string; range?: { from: number; to: number } };

const HTTP_OK = 200;
const HTTP_PARTIAL = 206;
const HTTP_NOT_FOUND = 404;

export interface ServedBuild {
  baseUrl: string;
  fetcher: Fetcher;
  requests: Request[];
  /** Serve these bytes instead of the file on disk (path relative to the build). */
  overrides: Map<string, Uint8Array>;
  /** Reject requests for these paths, like a dropped connection. */
  failing: Set<string>;
  /** Paths requested since the last reset, each once, sorted. */
  requested(): string[];
  reset(): void;
}

/** A static file server over a build folder: Range support, files read fresh on every request. */
export function serveBuild(outDir: string): ServedBuild {
  const requests: Request[] = [];
  const overrides = new Map<string, Uint8Array>();
  const failing = new Set<string>();
  const fetcher: Fetcher = {
    async get(url, range) {
      requests.push(range ? { url, range } : { url });
      const path = url.slice(BASE_URL.length + 1);
      if (failing.has(path)) throw new Error('connection dropped');
      const body = overrides.get(path) ?? (await readFile(join(outDir, path)).catch(() => null));
      if (!body) return { status: HTTP_NOT_FOUND, bytes: new Uint8Array() };
      const bytes = new Uint8Array(body);
      if (!range) return { status: HTTP_OK, bytes };
      return { status: HTTP_PARTIAL, bytes: bytes.slice(range.from, range.to + 1) };
    },
  };
  return {
    baseUrl: BASE_URL,
    fetcher,
    requests,
    overrides,
    failing,
    requested: () => [...new Set(requests.map((r) => r.url.slice(BASE_URL.length + 1)))].sort(),
    reset: () => {
      requests.length = 0;
    },
  };
}

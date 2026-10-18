import { CoreError } from './errors.js';

export const DOWNLOAD_CHUNK_BYTES = 262_144;

export interface FetchResult {
  status: number;
  bytes: Uint8Array;
}

export interface Fetcher {
  /** `to` is inclusive. A range is answered with 206, a full body with 200. */
  get(url: string, range?: { from: number; to: number }): Promise<FetchResult>;
}

export interface PartialStore {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface FileSpec {
  url: string;
  sha256: string;
  bytes: number;
}

const HTTP_OK = 200;
const HTTP_PARTIAL = 206;
const HEX_PAIR = 2;
const HEX_RADIX = 16;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(HEX_RADIX).padStart(HEX_PAIR, '0'),
  ).join('');
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

const failed = (spec: FileSpec, why: string): CoreError =>
  new CoreError('DOWNLOAD_FAILED', `download of ${spec.url} failed: ${why}`);

const tooLarge = (spec: FileSpec): CoreError =>
  new CoreError('BUNDLE_TOO_LARGE', `${spec.url} is larger than the ${spec.bytes} bytes listed`);

interface Deps {
  fetcher: Fetcher;
  partials: PartialStore;
  chunkBytes?: number;
}

async function request(spec: FileSpec, deps: Deps, have: number): Promise<FetchResult> {
  const chunk = deps.chunkBytes ?? DOWNLOAD_CHUNK_BYTES;
  const range = { from: have, to: Math.min(have + chunk, spec.bytes) - 1 };
  try {
    return await deps.fetcher.get(spec.url, range);
  } catch {
    throw failed(spec, 'the request did not complete');
  }
}

/** A server that ignored Range sent the whole file: it must match the listed size exactly. */
function takeFullBody(spec: FileSpec, bytes: Uint8Array): Uint8Array {
  if (bytes.length > spec.bytes) throw tooLarge(spec);
  if (bytes.length < spec.bytes) throw failed(spec, 'the file ended early');
  return bytes;
}

async function nextBytes(spec: FileSpec, deps: Deps, have: Uint8Array): Promise<Uint8Array> {
  const res = await request(spec, deps, have.length);
  if (res.status === HTTP_OK) return takeFullBody(spec, res.bytes);
  if (res.status !== HTTP_PARTIAL) throw failed(spec, `unexpected status ${res.status}`);
  const chunk = deps.chunkBytes ?? DOWNLOAD_CHUNK_BYTES;
  const asked = Math.min(chunk, spec.bytes - have.length);
  if (res.bytes.length > asked) throw tooLarge(spec);
  if (res.bytes.length === 0) throw failed(spec, 'the server sent an empty chunk');
  const joined = concat(have, res.bytes);
  await deps.partials.put(spec.sha256, joined);
  return joined;
}

/**
 * Download a file resumably and verify it. The partial is stored under the file's own SHA-256, so
 * different files can never mix. Errors are CoreErrors (DOWNLOAD_FAILED keeps the partial for a
 * retry; BUNDLE_TOO_LARGE and BUNDLE_CORRUPT drop it).
 */
export async function downloadFile(spec: FileSpec, deps: Deps): Promise<Uint8Array> {
  let have = (await deps.partials.get(spec.sha256)) ?? new Uint8Array();
  if (have.length > spec.bytes) have = new Uint8Array();
  try {
    while (have.length < spec.bytes) have = await nextBytes(spec, deps, have);
  } catch (error) {
    const keep = error instanceof CoreError && error.code === 'DOWNLOAD_FAILED' && have.length > 0;
    if (!keep) await deps.partials.delete(spec.sha256);
    throw error;
  }
  await deps.partials.delete(spec.sha256);
  if ((await sha256Hex(have)) !== spec.sha256) {
    throw new CoreError('BUNDLE_CORRUPT', `${spec.url} does not match its checksum`);
  }
  return have;
}

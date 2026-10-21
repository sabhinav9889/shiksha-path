import { MAX_BODY_BYTES } from '@shiksha/api-contract';
import type { Auth } from '../ports.js';
import { ApiFailure } from '../services/failure.js';

const BEARER = /^Bearer\s+(\S+)$/i;

/** The verified identity of the caller, from the access token only. */
export async function caller(request: Request, auth: Auth): Promise<string> {
  const token = BEARER.exec(request.headers.get('authorization') ?? '')?.[1];
  const verified = token ? await auth.verify(token) : null;
  if (!verified) throw new ApiFailure('UNAUTHENTICATED');
  return verified.authUserId;
}

/** Read the body, stopping as soon as it passes the limit (a chunked body has no length). */
async function readCapped(request: Request): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ApiFailure('TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** The JSON body, refusing anything larger than the API reads. */
export async function jsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    throw new ApiFailure('TOO_LARGE');
  }
  const text = await readCapped(request);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiFailure('INVALID_REQUEST');
  }
}

/** Parse with a contract schema; anything that does not fit is an invalid request. */
export function parseWith<T>(
  schema: { safeParse(v: unknown): { success: boolean; data?: T } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiFailure('INVALID_REQUEST');
  return parsed.data as T;
}

/** The path after the function prefix: `/functions/v1/api/v1/me` and `/v1/me` give `/v1/me`. */
export function routePath(url: URL): string {
  const at = url.pathname.lastIndexOf('/api/');
  return at >= 0 ? url.pathname.slice(at + '/api'.length) : url.pathname;
}

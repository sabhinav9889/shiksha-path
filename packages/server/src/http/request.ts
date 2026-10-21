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

/** The JSON body, refusing anything larger than the API reads. */
export async function jsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    throw new ApiFailure('TOO_LARGE');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new ApiFailure('TOO_LARGE');
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

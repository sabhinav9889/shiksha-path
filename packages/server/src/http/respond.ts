import type { ApiError } from '@shiksha/api-contract';

const STATUS: Record<ApiError, number> = {
  UNAUTHENTICATED: 401,
  NOT_LINKED: 403,
  FORBIDDEN: 403,
  INVALID_REQUEST: 400,
  PROFILE_TAKEN: 409,
  TOO_LARGE: 413,
  INTERNAL: 500,
  RATE_LIMITED: 429,
  FEATURE_OFF: 403,
  BAD_CODE: 401,
  NOT_STAFF: 403,
  DEACTIVATED: 403,
  NOT_EMPTY: 409,
};

const HTTP_OK = 200;

export function json(body: unknown, headers: Headers, status = HTTP_OK): Response {
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

/** Only the code reaches the client: no message, stack trace, SQL or path. */
export function failure(code: ApiError, headers: Headers, status = STATUS[code]): Response {
  return json({ error: code }, headers, status);
}

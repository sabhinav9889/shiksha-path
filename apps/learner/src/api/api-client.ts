import {
  errorBody,
  linkResponse,
  meResponse,
  pullResponse,
  pushResponse,
  recordingCompleteResponse,
  recordingStartResponse,
  type ApiError,
  type LinkRequest,
  type LinkResponse,
  type MeResponse,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type RecordingCompleteResponse,
  type RecordingStart,
  type RecordingStartResponse,
} from '@shiksha/api-contract';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError | 'OFFLINE' };

export interface ApiClient {
  link(body: LinkRequest): Promise<ApiResult<LinkResponse>>;
  push(body: PushRequest): Promise<ApiResult<PushResponse>>;
  pull(query: { after: number }): Promise<ApiResult<PullResponse>>;
  me(): Promise<ApiResult<MeResponse>>;
  startRecording(body: RecordingStart): Promise<ApiResult<RecordingStartResponse>>;
  completeRecording(body: { id: string }): Promise<ApiResult<RecordingCompleteResponse>>;
  /** Put the bytes at a signed upload URL (no sign-in token: the URL carries its own). */
  uploadTo(url: string, bytes: Uint8Array, mime: string): Promise<boolean>;
}

interface ClientDeps {
  baseUrl: string;
  token: () => Promise<string | null>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

type Schema<T> = { safeParse(v: unknown): { success: boolean; data?: T } };

const DEFAULT_TIMEOUT_MS = 20_000;

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/** PUT bytes to a signed upload URL; false on any failure (it is retried on a later sync). */
async function putBytes(o: {
  fetchFn: typeof fetch;
  timeoutMs: number;
  url: string;
  bytes: Uint8Array;
  mime: string;
}): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const body = new Blob([o.bytes as Uint8Array<ArrayBuffer>], { type: o.mime });
    const init = { method: 'PUT', headers: { 'content-type': o.mime }, body };
    return (await o.fetchFn(o.url, { ...init, signal: controller.signal })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The one module the app uses to talk to /v1. Every answer is checked against the contract. */
export function createApiClient(deps: ClientDeps): ApiClient {
  const fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call<T>(path: string, schema: Schema<T>, body?: unknown): Promise<ApiResult<T>> {
    const token = await deps.token();
    if (!token) return { ok: false, error: 'UNAUTHENTICATED' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const init: RequestInit = { method: body === undefined ? 'GET' : 'POST', headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    let response: Response;
    try {
      response = await fetchFn(`${deps.baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch {
      return { ok: false, error: 'OFFLINE' };
    } finally {
      clearTimeout(timer);
    }
    const payload = await readJson(response);
    if (!response.ok) {
      const parsed = errorBody.safeParse(payload);
      return { ok: false, error: parsed.success ? parsed.data.error : 'INTERNAL' };
    }
    const parsed = schema.safeParse(payload);
    return parsed.success
      ? { ok: true, value: parsed.data as T }
      : { ok: false, error: 'INTERNAL' };
  }

  return {
    link: (body) => call('/v1/learners/link', linkResponse, body),
    push: (body) => call('/v1/sync/push', pushResponse, body),
    pull: ({ after }) => call(`/v1/sync/pull?after=${after}`, pullResponse),
    me: () => call('/v1/me', meResponse),
    startRecording: (body) => call('/v1/recordings/start', recordingStartResponse, body),
    completeRecording: (body) => call('/v1/recordings/complete', recordingCompleteResponse, body),
    uploadTo: (url, bytes, mime) => putBytes({ fetchFn, timeoutMs, url, bytes, mime }),
  };
}

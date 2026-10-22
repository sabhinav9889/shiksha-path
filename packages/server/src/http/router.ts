import {
  codeSignIn,
  deletedCheck,
  deletedCheckResponse,
  linkRequest,
  linkResponse,
  meResponse,
  pullQuery,
  pullResponse,
  pushRequest,
  pushResponse,
  recordingComplete,
  recordingCompleteResponse,
  recordingStart,
  recordingStartResponse,
  session,
} from '@shiksha/api-contract';
import type { Logger } from '../logger.js';
import type {
  Auth,
  CodeAuth,
  CodeRepo,
  EventRepo,
  LearnerDataRepo,
  LearnerRepo,
  RateLimiter,
  RecordingRepo,
  RecordingStorage,
  SwitchRepo,
} from '../ports.js';
import { ApiFailure } from '../services/failure.js';
import { signInWithCode } from '../services/codes.js';
import { checkDeleted } from '../services/learner-data.js';
import { linkLearner } from '../services/link.js';
import { getMe } from '../services/me.js';
import { completeRecording, startRecording } from '../services/recordings.js';
import { pullEvents, pushEvents } from '../services/sync.js';
import { clientKey } from './client-key.js';
import { corsHeaders } from './cors.js';
import { caller, jsonBody, parseWith, routePath } from './request.js';
import { failure, json } from './respond.js';

export interface HandlerDeps {
  auth: Auth & CodeAuth;
  codes: CodeRepo;
  /** CODE_PEPPER: keys the code hashes and the network hash for rate limits. */
  pepper: string;
  learners: LearnerRepo;
  data: LearnerDataRepo;
  events: EventRepo;
  switches: SwitchRepo;
  limiter: RateLimiter;
  recordings: RecordingRepo;
  storage: RecordingStorage;
  allowedOrigins: readonly string[];
  logger: Logger;
}

const NO_CONTENT = 204;
const NOT_FOUND = 404;

type Route = (request: Request, url: URL, deps: HandlerDeps) => Promise<unknown>;

/** Each route parses its input with the contract, calls one service and checks the response. */
const ROUTES: Record<string, Route> = {
  'POST /v1/learners/link': async (request, _url, deps) => {
    const who = await caller(request, deps.auth);
    const body = parseWith(linkRequest, await jsonBody(request));
    return linkResponse.parse(await linkLearner(deps, who, body));
  },
  'POST /v1/sync/push': async (request, _url, deps) => {
    const { authUserId } = await caller(request, deps.auth);
    const body = parseWith(pushRequest, await jsonBody(request));
    return pushResponse.parse(await pushEvents(deps, authUserId, body));
  },
  'GET /v1/sync/pull': async (request, url, deps) => {
    const { authUserId } = await caller(request, deps.auth);
    const query = parseWith(pullQuery, Object.fromEntries(url.searchParams));
    return pullResponse.parse(await pullEvents(deps, authUserId, query));
  },
  'POST /v1/recordings/start': async (request, _url, deps) => {
    const { authUserId } = await caller(request, deps.auth);
    const body = parseWith(recordingStart, await jsonBody(request));
    return recordingStartResponse.parse(await startRecording(deps, authUserId, body));
  },
  'POST /v1/recordings/complete': async (request, _url, deps) => {
    const { authUserId } = await caller(request, deps.auth);
    const body = parseWith(recordingComplete, await jsonBody(request));
    return recordingCompleteResponse.parse(await completeRecording(deps, authUserId, body));
  },
  /** Public: a backup-code student has no session yet. Rate-limited per network and overall. */
  'POST /v1/auth/code': async (request, _url, deps) => {
    const body = parseWith(codeSignIn, await jsonBody(request));
    const key = await clientKey(request, deps.pepper);
    return session.parse(await signInWithCode(deps, body.code, key));
  },
  /** Public: a phone asks whether its profiles were deleted on request, to wipe them too. */
  'POST /v1/learners/deleted': async (request, _url, deps) => {
    const body = parseWith(deletedCheck, await jsonBody(request));
    const key = await clientKey(request, deps.pepper);
    return deletedCheckResponse.parse(await checkDeleted(deps, body.learnerIds, key));
  },
  'GET /v1/me': async (request, _url, deps) =>
    meResponse.parse(await getMe(deps, (await caller(request, deps.auth)).authUserId)),
};

/** The whole /v1 API as one function of a standard Request, for any runtime (Deno, Node). */
export async function handle(request: Request, deps: HandlerDeps): Promise<Response> {
  const headers = corsHeaders(request, deps.allowedOrigins);
  if (request.method === 'OPTIONS') return new Response(null, { status: NO_CONTENT, headers });
  const url = new URL(request.url);
  const name = `${request.method} ${routePath(url)}`;
  const started = Date.now();
  const route = ROUTES[name];
  if (!route) {
    deps.logger.info({ route: name, status: NOT_FOUND, code: 'INVALID_REQUEST', ms: 0 });
    return failure('INVALID_REQUEST', headers, NOT_FOUND);
  }
  try {
    const response = json(await route(request, url, deps), headers);
    deps.logger.info({ route: name, status: response.status, ms: Date.now() - started });
    return response;
  } catch (error) {
    const code = error instanceof ApiFailure ? error.code : 'INTERNAL';
    const response = failure(code, headers);
    const entry = { route: name, status: response.status, code, ms: Date.now() - started };
    if (code === 'INTERNAL') deps.logger.error(entry);
    else deps.logger.info(entry);
    return response;
  }
}

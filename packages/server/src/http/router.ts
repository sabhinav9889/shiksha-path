import {
  linkRequest,
  linkResponse,
  meResponse,
  pullQuery,
  pullResponse,
  pushRequest,
  pushResponse,
} from '@shiksha/api-contract';
import type { Logger } from '../logger.js';
import type { Auth, EventRepo, LearnerRepo, SwitchRepo } from '../ports.js';
import { ApiFailure } from '../services/failure.js';
import { linkLearner } from '../services/link.js';
import { getMe } from '../services/me.js';
import { pullEvents, pushEvents } from '../services/sync.js';
import { corsHeaders } from './cors.js';
import { caller, jsonBody, parseWith, routePath } from './request.js';
import { failure, json } from './respond.js';

export interface HandlerDeps {
  auth: Auth;
  learners: LearnerRepo;
  events: EventRepo;
  switches: SwitchRepo;
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

import { feedResponse } from '@shiksha/api-contract';
import {
  idResponse,
  okResponse,
  postDeleteRequest,
  postRequest,
  staffPostsResponse,
} from '@shiksha/api-contract/staff';
import * as community from '../services/community.js';
import { staffCaller } from '../services/staff.js';
import { caller, jsonBody, parseWith } from './request.js';
import type { HandlerDeps } from './router.js';

type Route = (request: Request, url: URL, deps: HandlerDeps) => Promise<unknown>;

const who = async (request: Request, deps: HandlerDeps) =>
  staffCaller(deps, await caller(request, deps.auth));

/** Community posts (spec §10.2): staff write, students read. Identity comes from the token. */
export const COMMUNITY_ROUTES: Record<string, Route> = {
  'GET /v1/staff/community/posts': async (request, _url, deps) =>
    staffPostsResponse.parse(await community.listStaffPosts(deps, await who(request, deps))),
  'POST /v1/staff/community/post': async (request, _url, deps) => {
    const staff = await who(request, deps);
    const body = parseWith(postRequest, await jsonBody(request));
    return idResponse.parse({ id: await community.savePost(deps, staff, body) });
  },
  'POST /v1/staff/community/delete': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await community.deletePost(deps, staff, parseWith(postDeleteRequest, await jsonBody(request)));
    return okResponse.parse({ ok: true });
  },
  'GET /v1/community/feed': async (request, _url, deps) =>
    feedResponse.parse(
      await community.getFeed(deps, (await caller(request, deps.auth)).authUserId),
    ),
};

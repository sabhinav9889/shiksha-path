import {
  myRecordingsResponse,
  myRecordingUrlQuery,
  myRecordingUrlResponse,
} from '@shiksha/api-contract';
import * as mine from '../services/my-recordings.js';
import { caller, parseWith } from './request.js';
import type { HandlerDeps } from './router.js';

type Route = (request: Request, url: URL, deps: HandlerDeps) => Promise<unknown>;

const student = async (request: Request, deps: HandlerDeps): Promise<string> =>
  (await caller(request, deps.auth)).authUserId;

/** A student's own recordings and the mentor's feedback on them. Identity comes from the token. */
export const MY_RECORDING_ROUTES: Record<string, Route> = {
  'GET /v1/me/recordings': async (request, _url, deps) =>
    myRecordingsResponse.parse(await mine.myRecordings(deps, await student(request, deps))),
  'GET /v1/me/recording-url': async (request, url, deps) => {
    const authUserId = await student(request, deps);
    const { id } = parseWith(myRecordingUrlQuery, Object.fromEntries(url.searchParams));
    return myRecordingUrlResponse.parse(await mine.myRecordingUrl(deps, authUserId, id));
  },
};

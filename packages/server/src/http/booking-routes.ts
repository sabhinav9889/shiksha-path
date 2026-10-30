import {
  bookRequest,
  cancelBookingRequest,
  myBookingsResponse,
  openSlotsResponse,
} from '@shiksha/api-contract';
import {
  idResponse,
  okResponse,
  slotRemoveRequest,
  slotRequest,
  staffSlotsResponse,
} from '@shiksha/api-contract/staff';
import * as booking from '../services/booking.js';
import { staffCaller } from '../services/staff.js';
import { caller, jsonBody, parseWith } from './request.js';
import type { HandlerDeps } from './router.js';

type Route = (request: Request, url: URL, deps: HandlerDeps) => Promise<unknown>;

const who = async (request: Request, deps: HandlerDeps) =>
  staffCaller(deps, await caller(request, deps.auth));
const student = async (request: Request, deps: HandlerDeps): Promise<string> =>
  (await caller(request, deps.auth)).authUserId;

/** One-to-one slots (spec §10.1): staff publish, students book. Identity comes from the token. */
export const BOOKING_ROUTES: Record<string, Route> = {
  'GET /v1/staff/booking/slots': async (request, _url, deps) =>
    staffSlotsResponse.parse(await booking.listStaffSlots(deps, await who(request, deps))),
  'POST /v1/staff/booking/slot': async (request, _url, deps) => {
    const staff = await who(request, deps);
    const body = parseWith(slotRequest, await jsonBody(request));
    return idResponse.parse({ id: await booking.publishSlot(deps, staff, body) });
  },
  'POST /v1/staff/booking/slot/remove': async (request, _url, deps) => {
    const staff = await who(request, deps);
    const body = parseWith(slotRemoveRequest, await jsonBody(request));
    await booking.removeSlot(deps, staff, body);
    return okResponse.parse({ ok: true });
  },
  'GET /v1/booking/slots': async (request, _url, deps) =>
    openSlotsResponse.parse(await booking.listOpenSlots(deps, await student(request, deps))),
  'POST /v1/booking/book': async (request, _url, deps) => {
    const authUserId = await student(request, deps);
    const body = parseWith(bookRequest, await jsonBody(request));
    return idResponse.parse(await booking.bookSlot(deps, authUserId, body));
  },
  'GET /v1/booking/mine': async (request, _url, deps) =>
    myBookingsResponse.parse(await booking.myBookings(deps, await student(request, deps))),
  'POST /v1/booking/cancel': async (request, _url, deps) => {
    const authUserId = await student(request, deps);
    const body = parseWith(cancelBookingRequest, await jsonBody(request));
    await booking.cancelBooking(deps, authUserId, body);
    return okResponse.parse({ ok: true });
  },
};

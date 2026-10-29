import {
  adminSetup,
  brandingVersion,
  cohortRequest,
  deactivateRequest,
  deleteGroupRequest,
  deleteRequest,
  idResponse,
  labRequest,
  okResponse,
  overrideRequest,
  staffRequest,
  studentEditRequest,
  studentsPage,
  studentsQuery,
  switchRequest,
} from '@shiksha/api-contract/staff';
import * as admin from '../services/admin.js';
import { staffCaller } from '../services/staff.js';
import { caller, jsonBody, parseWith } from './request.js';
import type { HandlerDeps } from './router.js';

type Route = (request: Request, url: URL, deps: HandlerDeps) => Promise<unknown>;
const OK = { ok: true } as const;

const who = async (request: Request, deps: HandlerDeps) =>
  staffCaller(deps, await caller(request, deps.auth));

/** The admin panel's API (spec §8.1). Every service checks the admin role itself. */
export const ADMIN_ROUTES: Record<string, Route> = {
  'GET /v1/staff/admin/setup': async (request, _url, deps) =>
    adminSetup.parse(await admin.getSetup(deps, await who(request, deps))),
  'POST /v1/staff/admin/lab': async (request, _url, deps) => {
    const staff = await who(request, deps);
    const body = parseWith(labRequest, await jsonBody(request));
    return idResponse.parse({ id: await admin.saveLab(deps, staff, body) });
  },
  'POST /v1/staff/admin/cohort': async (request, _url, deps) => {
    const staff = await who(request, deps);
    const body = parseWith(cohortRequest, await jsonBody(request));
    return idResponse.parse({ id: await admin.saveCohort(deps, staff, body) });
  },
  'POST /v1/staff/admin/lab/delete': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.deleteLab(deps, staff, parseWith(deleteGroupRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/cohort/delete': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.deleteCohort(deps, staff, parseWith(deleteGroupRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/staff': async (request, _url, deps) => {
    const staff = await who(request, deps);
    const body = parseWith(staffRequest, await jsonBody(request));
    return idResponse.parse({ id: await admin.saveStaff(deps, staff, body) });
  },
  'GET /v1/staff/admin/students': async (request, url, deps) => {
    const staff = await who(request, deps);
    const filter = parseWith(studentsQuery, Object.fromEntries(url.searchParams));
    return studentsPage.parse(await admin.searchStudents(deps, staff, filter));
  },
  'POST /v1/staff/admin/student': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.editStudent(deps, staff, parseWith(studentEditRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/deactivate': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.setActive(deps, staff, parseWith(deactivateRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/delete': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.deleteStudent(deps, staff, parseWith(deleteRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/switch': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.setSwitch(deps, staff, parseWith(switchRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/override': async (request, _url, deps) => {
    const staff = await who(request, deps);
    await admin.setOverride(deps, staff, parseWith(overrideRequest, await jsonBody(request)));
    return okResponse.parse(OK);
  },
  'POST /v1/staff/admin/branding': async (request, _url, deps) => {
    const staff = await who(request, deps);
    return brandingVersion.parse(
      await admin.setBrandingAdmin(deps, staff, await jsonBody(request)),
    );
  },
};

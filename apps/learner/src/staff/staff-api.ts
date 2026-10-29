// The staff section's calls to /v1/staff/* (Plan 4a). Loaded only with the staff section.
import {
  adminSetup,
  attendanceResponse,
  auditPage,
  brandingVersion,
  codeIssueResponse,
  codeResetResponse,
  idResponse,
  levelResponse,
  okResponse,
  recordingUrlResponse,
  reviewResponse,
  staffCohorts,
  staffMe,
  studentDetail,
  studentsPage,
  unreviewedRecordings,
} from '@shiksha/api-contract/staff';
import { makeCaller, type Call, type ClientDeps } from '../api/api-client.js';

const query = (params: Record<string, string | boolean | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length === 0
    ? ''
    : `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
};

function staffMethods(call: Call) {
  return {
    claim: () => call('/v1/staff/claim', staffMe, {}),
    me: () => call('/v1/staff/me', staffMe),
    cohorts: () => call('/v1/staff/cohorts', staffCohorts),
    student: (id: string) => call(`/v1/staff/student${query({ id })}`, studentDetail),
    unreviewed: () => call('/v1/staff/recordings?status=unreviewed', unreviewedRecordings),
    recordingUrl: (id: string) =>
      call(`/v1/staff/recording-url${query({ id })}`, recordingUrlResponse),
    review: (body: { id: string; comment?: string }) =>
      call('/v1/staff/recordings/review', reviewResponse, body),
    issueCode: (body: { learnerId: string } | { name: string; cohortId: string }) =>
      call('/v1/staff/codes/issue', codeIssueResponse, body),
    resetCode: (body: { learnerId: string }) =>
      call('/v1/staff/codes/reset', codeResetResponse, body),
    setLevel: (body: { learnerId: string; track: string; startLesson: string }) =>
      call('/v1/staff/level', levelResponse, body),
    attendance: (body: { cohortId: string; day: string; present: string[] }) =>
      call('/v1/staff/attendance', attendanceResponse, body),
    audit: (before?: number) =>
      call(`/v1/staff/audit${query({ before: before?.toString() })}`, auditPage),
    setup: () => call('/v1/staff/admin/setup', adminSetup),
    saveLab: (body: { id?: string; name: string }) => call('/v1/staff/admin/lab', idResponse, body),
    saveCohort: (body: { id?: string; name: string; labId: string | null }) =>
      call('/v1/staff/admin/cohort', idResponse, body),
    deleteLab: (body: { id: string }) => call('/v1/staff/admin/lab/delete', okResponse, body),
    deleteCohort: (body: { id: string }) => call('/v1/staff/admin/cohort/delete', okResponse, body),
    saveStaff: (body: {
      id?: string;
      email: string;
      role: 'mentor' | 'admin';
      name: string;
      active: boolean;
      cohortIds: string[];
    }) => call('/v1/staff/admin/staff', idResponse, body),
    students: (filter: Record<string, string | boolean | undefined>) =>
      call(`/v1/staff/admin/students${query(filter)}`, studentsPage),
    editStudent: (body: { learnerId: string; name?: string; cohortId?: string | null }) =>
      call('/v1/staff/admin/student', okResponse, body),
    setActive: (body: { learnerId: string; active: boolean }) =>
      call('/v1/staff/admin/deactivate', okResponse, body),
    deleteStudent: (body: { learnerId: string }) =>
      call('/v1/staff/admin/delete', okResponse, body),
    setSwitch: (body: { key: string; enabledForAll: boolean }) =>
      call('/v1/staff/admin/switch', okResponse, body),
    setOverride: (body: { learnerId: string; key: string; enabled: boolean | null }) =>
      call('/v1/staff/admin/override', okResponse, body),
    setBranding: (body: unknown) => call('/v1/staff/admin/branding', brandingVersion, body),
  };
}

export type StaffApi = ReturnType<typeof staffMethods>;

export function createStaffApi(deps: ClientDeps): StaffApi {
  return staffMethods(makeCaller(deps));
}

import { FEATURE_KEYS, type FeatureKey } from '@shiksha/api-contract';
import { type AdminSetup, type StudentsPage } from '@shiksha/api-contract/staff';
import type {
  AuditRepo,
  BrandingRepo,
  OrgRepo,
  StudentRow,
  StaffRepo,
  StaffRole,
  SummaryRepo,
  SwitchRepo,
} from '../ports.js';
import { withAudit } from './audit.js';
import { setBranding } from './branding.js';
import { ApiFailure } from './failure.js';
import { deleteLearner, type LearnerDataDeps } from './learner-data.js';
import { inScope, type StaffCaller } from './staff.js';
import { asOfToday, needsAttention, type Attention, type Summary } from './summary.js';
import { istDay } from '@shiksha/learner-core';

export interface AdminDeps extends LearnerDataDeps {
  org: OrgRepo;
  staff: StaffRepo;
  switches: SwitchRepo;
  summaries: SummaryRepo;
  branding: BrandingRepo;
  audit: AuditRepo;
}

/** Everything in this file is for admins only (spec §8.1). */
function requireAdmin(staff: StaffCaller): void {
  if (staff.role !== 'admin') throw new ApiFailure('FORBIDDEN');
}

const PAGE = 50;

export async function saveLab(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { id?: string | undefined; name: string },
): Promise<string> {
  requireAdmin(staff);
  const record = { staff, action: 'lab_saved' as const, learnerId: null, details: {} };
  const { id, name } = input;
  return withAudit(deps, record, () => deps.org.saveLab(id ? { id, name } : { name }));
}

export async function saveCohort(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { id?: string | undefined; name: string; labId: string | null },
): Promise<string> {
  requireAdmin(staff);
  const details = { labId: input.labId };
  const record = { staff, action: 'cohort_saved' as const, learnerId: null, details };
  const { id, ...rest } = input;
  return withAudit(deps, record, () => deps.org.saveCohort(id ? { id, ...rest } : rest));
}

/** Invite or change a staff member. An email already used by someone else is refused. */
export async function saveStaff(
  deps: AdminDeps,
  staff: StaffCaller,
  input: {
    id?: string | undefined;
    email: string;
    role: StaffRole;
    name: string;
    active: boolean;
    cohortIds: string[];
  },
): Promise<string> {
  requireAdmin(staff);
  // An admin cannot pause or demote themselves, so at least one active admin always remains.
  const demotesSelf = input.id === staff.staffId && (!input.active || input.role !== 'admin');
  if (demotesSelf) throw new ApiFailure('INVALID_REQUEST');
  const clash = await deps.staff.byEmail(input.email);
  if (clash && clash.id !== input.id) throw new ApiFailure('INVALID_REQUEST');
  const action = input.id ? ('staff_changed' as const) : ('staff_invited' as const);
  const details = { role: input.role, active: input.active, cohorts: input.cohortIds.length };
  const { id, ...rest } = input;
  const row = id ? { id, ...rest } : rest;
  return withAudit(deps, { staff, action, learnerId: null, details }, () => deps.staff.save(row));
}

export interface StudentFilter {
  q?: string | undefined;
  cohortId?: string | undefined;
  mentorId?: string | undefined;
  active?: boolean | undefined;
  attention?: boolean | undefined;
  after?: string | undefined;
}

/** The cohorts a search is limited to: a cohort, a mentor's cohorts, both, or none (all). */
async function searchCohorts(
  deps: AdminDeps,
  filter: StudentFilter,
): Promise<string[] | undefined> {
  const mentorCohorts = filter.mentorId
    ? ((await deps.staff.byId(filter.mentorId))?.cohortIds ?? [])
    : undefined;
  if (!filter.cohortId) return mentorCohorts;
  return [filter.cohortId].filter((c) => !mentorCohorts || mentorCohorts.includes(c));
}

type Listed = StudentsPage['students'][number];

/** One page of rows from the repository, after the learner with id `after`. */
function readPage(
  deps: AdminDeps,
  filter: StudentFilter,
  cohortIds: string[] | undefined,
  after: string | undefined,
): ReturnType<OrgRepo['search']> {
  return deps.org.search({
    ...(filter.q ? { q: filter.q } : {}),
    ...(cohortIds ? { cohortIds } : {}),
    ...(filter.active === undefined ? {} : { active: filter.active }),
    ...(after ? { after } : {}),
    limit: PAGE,
  });
}

/** Admin search: name text, cohort, mentor, active and "needs attention", 50 per page. */
export async function searchStudents(
  deps: AdminDeps,
  staff: StaffCaller,
  filter: StudentFilter,
): Promise<StudentsPage> {
  requireAdmin(staff);
  const cohortIds = await searchCohorts(deps, filter);
  const today = istDay(new Date());
  const students: Listed[] = [];
  let after = filter.after;
  // "Needs attention" is known only after reading the summaries, so keep reading pages until
  // 50 are kept or the list ends: a flagged student past the first 50 names is still found.
  for (;;) {
    const rows = await readPage(deps, filter, cohortIds, after);
    const summaries = await deps.summaries.forLearners(rows.map((r) => r.id));
    const kept = rows
      .map((row) => withAttention(row, summaries.get(row.id) ?? null, today))
      .filter((s) => !filter.attention || s.attention.length > 0);
    const room = PAGE - students.length;
    students.push(...kept.slice(0, room));
    const last = students.at(-1);
    if (kept.length >= room && last) {
      const more =
        rows.findIndex((r) => r.id === last.id) < rows.length - 1 || rows.length === PAGE;
      return { students, next: more ? last.id : null };
    }
    after = rows.at(-1)?.id;
    if (rows.length < PAGE || !after) return { students, next: null };
  }
}

function withAttention(row: StudentRow, saved: Summary | null, today: string): Listed {
  const summary = saved && asOfToday(saved, today);
  const attention: Attention[] = summary ? needsAttention(summary, row.linkedOn, today) : [];
  return { ...row, summary, attention };
}

/** Rename and/or move a student to another cohort (which moves them to its mentors). */
export async function editStudent(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { learnerId: string; name?: string | undefined; cohortId?: string | null | undefined },
): Promise<void> {
  requireAdmin(staff);
  await inScope(deps, staff, input.learnerId);
  const { learnerId, name, cohortId } = input;
  // One action, one audit entry: a rename together with a move is a single `student_edited`.
  const renamed = name !== undefined;
  const moved = cohortId !== undefined;
  if (!renamed && !moved) return;
  const record = {
    staff,
    action: renamed ? ('student_edited' as const) : ('student_moved' as const),
    learnerId,
    details: moved ? { to: cohortId } : {},
  };
  await withAudit(deps, record, async () => {
    if (renamed) await deps.org.renameLearner(learnerId, name);
    if (moved) await deps.org.setLearnerCohort(learnerId, cohortId);
  });
}

/** Deactivate (sync refused, data kept) or reactivate a student. */
export async function setActive(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { learnerId: string; active: boolean },
): Promise<void> {
  requireAdmin(staff);
  await inScope(deps, staff, input.learnerId);
  const action = input.active ? ('student_reactivated' as const) : ('student_deactivated' as const);
  const record = { staff, action, learnerId: input.learnerId, details: {} };
  await withAudit(deps, record, () => deps.org.setDeactivated(input.learnerId, !input.active));
}

/** Delete on request, everywhere (Plan 3b). The audit entry keeps no id of the student. */
export async function deleteStudent(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { learnerId: string },
): Promise<void> {
  requireAdmin(staff);
  await inScope(deps, staff, input.learnerId);
  const record = {
    staff,
    action: 'student_deleted' as const,
    learnerId: null,
    details: { learner: 'DELETED' },
  };
  await withAudit(deps, record, () => deleteLearner(deps, input.learnerId));
}

function knownKey(key: string): asserts key is FeatureKey {
  if (!(FEATURE_KEYS as readonly string[]).includes(key)) throw new ApiFailure('INVALID_REQUEST');
}

export async function setSwitch(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { key: string; enabledForAll: boolean },
): Promise<void> {
  requireAdmin(staff);
  knownKey(input.key);
  const details = { key: input.key, enabled: input.enabledForAll };
  const record = { staff, action: 'switch_changed' as const, learnerId: null, details };
  await withAudit(deps, record, () => deps.switches.setForAll(input.key, input.enabledForAll));
}

export async function setOverride(
  deps: AdminDeps,
  staff: StaffCaller,
  input: { learnerId: string; key: string; enabled: boolean | null },
): Promise<void> {
  requireAdmin(staff);
  knownKey(input.key);
  await inScope(deps, staff, input.learnerId);
  const { learnerId, key, enabled } = input;
  const record = {
    staff,
    action: 'override_changed' as const,
    learnerId,
    details: { key, enabled },
  };
  await withAudit(deps, record, () => deps.switches.setOverride(learnerId, key, enabled));
}

/** The name and colours, with the contrast rule (Plan 3b). */
export async function setBrandingAdmin(
  deps: AdminDeps,
  staff: StaffCaller,
  input: unknown,
): Promise<{ version: number }> {
  requireAdmin(staff);
  const record = { staff, action: 'branding_changed' as const, learnerId: null, details: {} };
  return withAudit(deps, record, () => setBranding(deps, input));
}

/** Labs, cohorts and staff for the setup screen. */
export async function getSetup(deps: AdminDeps, staff: StaffCaller): Promise<AdminSetup> {
  requireAdmin(staff);
  const [labs, cohorts, members, all] = await Promise.all([
    deps.org.labs(),
    deps.org.cohorts('all'),
    deps.staff.list(),
    deps.switches.allStudents(),
  ]);
  return {
    labs,
    cohorts,
    staff: members.map(({ authUserId, ...m }) => ({ ...m, claimed: authUserId !== null })),
    switches: Object.fromEntries(FEATURE_KEYS.map((key) => [key, all[key] ?? true])) as Record<
      FeatureKey,
      boolean
    >,
  };
}

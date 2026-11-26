import type { AuditRepo, OrgRepo } from '../ports.js';
import { withAudit } from './audit.js';
import { ApiFailure } from './failure.js';
import { requireAdmin } from './require-admin.js';
import type { StaffCaller } from './staff.js';

/** What labs and cohorts need: the org repository and the audit log. */
export interface GroupDeps {
  org: OrgRepo;
  audit: AuditRepo;
}

/**
 * Create a lab, or rename one when `id` is given. An id that is not there is refused, never
 * created: an edit must not mint a row with a client-chosen id.
 */
export async function saveLab(
  deps: GroupDeps,
  staff: StaffCaller,
  input: { id?: string | undefined; name: string },
): Promise<string> {
  requireAdmin(staff);
  const { id, name } = input;
  if (id === undefined) {
    const record = { staff, action: 'lab_saved' as const, learnerId: null, details: {} };
    return withAudit(deps, record, () => deps.org.saveLab({ name }));
  }
  const record = { staff, action: 'lab_saved' as const, learnerId: null, details: { id, name } };
  return withAudit(deps, record, async () => {
    if (!(await deps.org.updateLab(id, name))) throw new ApiFailure('INVALID_REQUEST');
    return id;
  });
}

/** Create a cohort, or rename and move one when `id` is given. A missing lab is refused. */
export async function saveCohort(
  deps: GroupDeps,
  staff: StaffCaller,
  input: { id?: string | undefined; name: string; labId: string | null },
): Promise<string> {
  requireAdmin(staff);
  const { id, name, labId } = input;
  if (labId !== null && !(await deps.org.labs()).some((lab) => lab.id === labId)) {
    throw new ApiFailure('INVALID_REQUEST');
  }
  if (id === undefined) {
    const record = { staff, action: 'cohort_saved' as const, learnerId: null, details: { labId } };
    return withAudit(deps, record, () => deps.org.saveCohort({ name, labId }));
  }
  const details = { id, name, labId };
  const record = { staff, action: 'cohort_saved' as const, learnerId: null, details };
  return withAudit(deps, record, async () => {
    if (!(await deps.org.updateCohort(id, { name, labId })))
      throw new ApiFailure('INVALID_REQUEST');
    return id;
  });
}

/** Delete an empty lab or cohort. The name goes in the log: the id alone means nothing after. */
async function deleteGroup(
  deps: GroupDeps,
  staff: StaffCaller,
  kind: 'lab' | 'cohort',
  id: string,
): Promise<void> {
  requireAdmin(staff);
  const found = kind === 'lab' ? await deps.org.labs() : await deps.org.cohorts('all');
  const name = found.find((row) => row.id === id)?.name;
  if (name === undefined) throw new ApiFailure('INVALID_REQUEST');
  const record = {
    staff,
    action: `${kind}_deleted` as const,
    learnerId: null,
    details: { id, name },
  };
  await withAudit(deps, record, async () => {
    const result = await (kind === 'lab' ? deps.org.deleteLab(id) : deps.org.deleteCohort(id));
    if (result === 'not_empty') throw new ApiFailure('NOT_EMPTY');
    if (result === 'missing') throw new ApiFailure('INVALID_REQUEST');
  });
}

export const deleteLab = (
  deps: GroupDeps,
  staff: StaffCaller,
  input: { id: string },
): Promise<void> => deleteGroup(deps, staff, 'lab', input.id);

export const deleteCohort = (
  deps: GroupDeps,
  staff: StaffCaller,
  input: { id: string },
): Promise<void> => deleteGroup(deps, staff, 'cohort', input.id);

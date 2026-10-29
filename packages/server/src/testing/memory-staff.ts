import { randomUUID } from 'node:crypto';
import type { LearnerRow, OrgRepo, StaffRepo, StaffRow, StudentRow } from '../ports.js';

export function memoryStaff(): StaffRepo {
  const rows = new Map<string, StaffRow>();
  const copy = (row: StaffRow | undefined): StaffRow | null => (row ? structuredClone(row) : null);
  return {
    byId: (id) => Promise.resolve(copy(rows.get(id))),
    byAuthUser: (auth) =>
      Promise.resolve(copy([...rows.values()].find((r) => r.authUserId === auth))),
    byEmail: (email) =>
      Promise.resolve(
        copy([...rows.values()].find((r) => r.email.toLowerCase() === email.toLowerCase())),
      ),
    claim(id, auth) {
      const row = rows.get(id);
      if (!row || row.authUserId) return Promise.resolve(false);
      rows.set(id, { ...row, authUserId: auth });
      return Promise.resolve(true);
    },
    save(input) {
      const id = input.id ?? randomUUID();
      const clash = [...rows.values()].find(
        (r) => r.id !== id && r.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (clash) return Promise.reject(new Error('email already invited'));
      const authUserId = rows.get(id)?.authUserId ?? null;
      rows.set(id, { ...structuredClone(input), id, authUserId });
      return Promise.resolve(id);
    },
    list: () => Promise.resolve([...rows.values()].map((r) => structuredClone(r))),
    delete(id) {
      const row = rows.get(id);
      const others = [...rows.values()].filter(
        (r) => r.role === 'admin' && r.active && r.id !== id,
      );
      if (row?.role === 'admin' && others.length === 0) return Promise.resolve(false);
      return Promise.resolve(rows.delete(id));
    },
  };
}

export function memoryOrg(
  learners: Map<string, LearnerRow>,
  lastReceived: ReadonlyMap<string, string> = new Map(),
): OrgRepo {
  const labs = new Map<string, string>();
  const cohorts = new Map<string, { id: string; name: string; labId: string | null }>();
  const cohortOf = new Map<string, string | null>();
  const deactivated = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const row = (l: LearnerRow): StudentRow => ({
    id: l.id,
    name: l.name,
    cohortId: cohortOf.get(l.id) ?? null,
    deactivated: deactivated.has(l.id),
    linkedOn: today,
    lastSyncedAt: lastReceived.get(l.id) ?? null,
  });
  return {
    saveLab({ id = randomUUID(), name }) {
      labs.set(id, name);
      return Promise.resolve(id);
    },
    saveCohort({ id = randomUUID(), name, labId }) {
      cohorts.set(id, { id, name, labId });
      return Promise.resolve(id);
    },
    deleteLab(id) {
      if (!labs.has(id)) return Promise.resolve('missing');
      if ([...cohorts.values()].some((c) => c.labId === id)) return Promise.resolve('not_empty');
      labs.delete(id);
      return Promise.resolve('deleted');
    },
    deleteCohort(id) {
      if (!cohorts.has(id)) return Promise.resolve('missing');
      if ([...cohortOf.values()].some((c) => c === id)) return Promise.resolve('not_empty');
      cohorts.delete(id);
      return Promise.resolve('deleted');
    },
    setLearnerCohort(learnerId, cohortId) {
      cohortOf.set(learnerId, cohortId);
      return Promise.resolve();
    },
    cohortOfLearner: (learnerId) =>
      Promise.resolve(learners.has(learnerId) ? (cohortOf.get(learnerId) ?? null) : undefined),
    labs: () => Promise.resolve([...labs].map(([id, name]) => ({ id, name }))),
    setDeactivated(learnerId, value) {
      if (value) deactivated.add(learnerId);
      else deactivated.delete(learnerId);
      const learner = learners.get(learnerId);
      if (learner) learners.set(learnerId, { ...learner, deactivated: value });
      return Promise.resolve();
    },
    renameLearner(learnerId, name) {
      const learner = learners.get(learnerId);
      if (learner) learners.set(learnerId, { ...learner, name });
      return Promise.resolve();
    },
    search({ q, cohortIds, active, after, limit }) {
      const all = [...learners.values()].map(row);
      return Promise.resolve(
        all
          .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))
          .filter((s) => !cohortIds || (s.cohortId !== null && cohortIds.includes(s.cohortId)))
          .filter((s) => active === undefined || s.deactivated !== active)
          .sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id))
          .filter((s) => {
            const from = after ? learners.get(after) : undefined;
            if (!after) return true;
            if (!from) return false;
            return s.name.localeCompare(from.name) > 0 || (s.name === from.name && s.id > from.id);
          })
          .slice(0, limit),
      );
    },
    students: (ids) =>
      Promise.resolve(
        [...learners.values()]
          .map(row)
          .filter((s) => ids === 'all' || (s.cohortId !== null && ids.includes(s.cohortId))),
      ),
    student: (id) => Promise.resolve(learners.has(id) ? row(learners.get(id) as LearnerRow) : null),
    cohorts: (ids) =>
      Promise.resolve([...cohorts.values()].filter((c) => ids === 'all' || ids.includes(c.id))),
  };
}

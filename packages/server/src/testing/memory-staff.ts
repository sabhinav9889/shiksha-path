import { randomUUID } from 'node:crypto';
import type { LearnerRow, OrgRepo, StaffRepo, StaffRow } from '../ports.js';

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
  };
}

export function memoryOrg(learners: Map<string, LearnerRow>): OrgRepo {
  const labs = new Map<string, string>();
  const cohorts = new Map<string, { id: string; name: string; labId: string | null }>();
  const cohortOf = new Map<string, string | null>();
  return {
    saveLab({ id = randomUUID(), name }) {
      labs.set(id, name);
      return Promise.resolve(id);
    },
    saveCohort({ id = randomUUID(), name, labId }) {
      cohorts.set(id, { id, name, labId });
      return Promise.resolve(id);
    },
    setLearnerCohort(learnerId, cohortId) {
      cohortOf.set(learnerId, cohortId);
      return Promise.resolve();
    },
    cohortOfLearner: (learnerId) =>
      Promise.resolve(learners.has(learnerId) ? (cohortOf.get(learnerId) ?? null) : undefined),
    cohorts: (ids) =>
      Promise.resolve([...cohorts.values()].filter((c) => ids === 'all' || ids.includes(c.id))),
  };
}

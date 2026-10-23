import type { AuditEntry, AuditRepo } from '../ports.js';

export function memoryAudit(): AuditRepo {
  const rows: AuditEntry[] = [];
  let next = 0;
  return {
    add(entry) {
      next += 1;
      rows.push({ ...structuredClone(entry), id: next, at: new Date().toISOString() });
      return Promise.resolve();
    },
    page: (before, limit) =>
      Promise.resolve(
        rows
          .filter((r) => before === null || r.id < before)
          .sort((a, b) => b.id - a.id)
          .slice(0, limit)
          .map((r) => structuredClone(r)),
      ),
    anonymiseLearner(learnerId) {
      for (const row of rows.filter((r) => r.learnerId === learnerId)) {
        row.learnerId = null;
        row.details = { ...row.details, learner: 'DELETED' };
      }
      return Promise.resolve();
    },
  };
}

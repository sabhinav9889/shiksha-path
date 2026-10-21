import type { RecordingRepo, RecordingRow } from '../ports.js';

const DAY_MS = 86_400_000;
const REVIEWED_DAYS = 30;
const UNREVIEWED_DAYS = 90;
const PENDING_DAYS = 7;

/** The retention rules (Plan 3b): the Postgres repo applies the same three in SQL. */
export function isDue(row: RecordingRow, now: Date): boolean {
  const age = (at: string | null): number => (at ? now.getTime() - Date.parse(at) : 0);
  if (row.reviewedAt) return age(row.reviewedAt) > REVIEWED_DAYS * DAY_MS;
  if (row.status === 'uploaded') return age(row.uploadedAt) > UNREVIEWED_DAYS * DAY_MS;
  return age(row.createdAt) > PENDING_DAYS * DAY_MS;
}

export function memoryRecordingRepo(
  now: () => Date = () => new Date(),
): RecordingRepo & { rows: Map<string, RecordingRow> } {
  const rows = new Map<string, RecordingRow>();
  return {
    rows,
    create(row) {
      const existing = rows.get(row.id);
      if (existing) {
        return Promise.resolve(existing.learnerId === row.learnerId ? 'exists' : 'ownedByOther');
      }
      const createdAt = now().toISOString();
      rows.set(row.id, {
        ...row,
        status: 'pending',
        uploadedAt: null,
        reviewedAt: null,
        createdAt,
      });
      return Promise.resolve('created');
    },
    get: (id) => Promise.resolve(structuredClone(rows.get(id) ?? null)),
    markUploaded(id, at) {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, status: 'uploaded', uploadedAt: at.toISOString() });
      return Promise.resolve();
    },
    listByLearner: (learnerId) =>
      Promise.resolve([...rows.values()].filter((r) => r.learnerId === learnerId)),
    due: (now) => Promise.resolve([...rows.values()].filter((r) => isDue(r, now))),
    delete(ids) {
      for (const id of ids) rows.delete(id);
      return Promise.resolve();
    },
  };
}

import type { AttendanceRepo } from '../ports.js';

export function memoryAttendance(): AttendanceRepo {
  const marks = new Map<string, Map<string, boolean>>(); // learner -> day -> present
  return {
    markDay({ learnerIds, present, day }) {
      for (const id of learnerIds) {
        const days = marks.get(id) ?? new Map<string, boolean>();
        days.set(day, present.has(id));
        marks.set(id, days);
      }
      return Promise.resolve(learnerIds.length);
    },
    forLearner: (learnerId, fromDay) =>
      Promise.resolve(
        [...(marks.get(learnerId) ?? [])]
          .filter(([day]) => day >= fromDay)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, present]) => ({ date, present })),
      ),
  };
}

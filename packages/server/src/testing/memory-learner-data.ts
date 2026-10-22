import type { LearnerEvent } from '@shiksha/learner-core';
import type { EventRepo, LearnerDataRepo, LearnerRow } from '../ports.js';

interface State {
  learners: Map<string, LearnerRow>;
  identities: Map<string, string>; // auth user -> learner
  eventRepo: EventRepo;
  overrides: Map<string, Map<string, boolean>>;
}

const ALL = Number.MAX_SAFE_INTEGER;

/** Export and deletion over the memory repos, with tombstones like Postgres. */
export function memoryLearnerData(state: State): LearnerDataRepo {
  const tombstones = new Set<string>();
  const authOf = (learnerId: string): string[] =>
    [...state.identities].filter(([, l]) => l === learnerId).map(([auth]) => auth);
  return {
    async rows(learnerId) {
      const learner = state.learners.get(learnerId);
      if (!learner) return null;
      const { events } = await state.eventRepo.page(learnerId, 0, ALL);
      return {
        learner: { ...learner, cohortId: null, createdAt: new Date(0).toISOString() },
        authUserIds: authOf(learnerId),
        events: events.map((e) => {
          const copy: Partial<typeof e> = { ...e };
          delete copy.seq;
          return copy as LearnerEvent;
        }),
        overrides: Object.fromEntries(state.overrides.get(learnerId) ?? []),
      };
    },
    async deleteWithTombstone(learnerId) {
      const { events } = await state.eventRepo.page(learnerId, 0, ALL);
      state.learners.delete(learnerId);
      for (const auth of authOf(learnerId)) state.identities.delete(auth);
      state.overrides.delete(learnerId);
      tombstones.add(learnerId);
      return { events: events.length };
    },
    deleted: (ids) => Promise.resolve(ids.filter((id) => tombstones.has(id))),
    deletedSince: () => Promise.resolve([...tombstones]),
  };
}

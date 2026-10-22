import { randomUUID } from 'node:crypto';
import type { LearnerEvent } from '@shiksha/learner-core';
import {
  LinkConflict,
  type CodeRepo,
  type EventRepo,
  type LearnerRepo,
  type LearnerDataRepo,
  type LearnerRow,
  type SwitchRepo,
} from '../ports.js';
import { memoryAttendance } from './memory-attendance.js';
import { memoryAuth, memoryCodeRepo } from './memory-auth.js';
import { memoryAudit } from './memory-audit.js';
import { memorySummaries } from './memory-summaries.js';
import { memoryBranding } from './memory-branding.js';
import { memoryOrg, memoryStaff } from './memory-staff.js';
import { memoryLearnerData } from './memory-learner-data.js';
import { memoryRateLimiter } from './memory-rate-limiter.js';
import { memoryRecordingRepo } from './memory-recording-repo.js';
import { memoryRecordingStorage } from './memory-recording-storage.js';
import type { ServiceFixture } from './service-contract.js';

const SEED_KEYS = [
  'ai_doubts',
  'speaking_practice',
  'placement_test',
  'english_only_option',
  'mentor_booking',
  'community_feed',
];

/** The memory repos, plus the identity map the memory code repo shares (auth user → learner). */
export type MemoryRepos = ServiceFixture & {
  identities: Map<string, string>;
  learnerRows: Map<string, LearnerRow>;
  data: LearnerDataRepo;
};

/** In-memory repositories with the same behaviour as the Postgres ones. */
export function makeMemoryRepos(): MemoryRepos {
  const learners = new Map<string, LearnerRow>();
  const identities = new Map<string, string>();
  const events: (LearnerEvent & { seq: number })[] = [];
  const allStudents = new Map(SEED_KEYS.map((key) => [key, true]));
  const overrides = new Map<string, Map<string, boolean>>();
  let seq = 0;

  const learnerRepo: LearnerRepo = {
    findByAuthUser: (authUserId) => {
      const id = identities.get(authUserId);
      return Promise.resolve(id ? (learners.get(id) ?? null) : null);
    },
    findById: (id) => Promise.resolve(learners.get(id) ?? null),
    createLinked: ({ id, name, authUserId }) => {
      if (learners.has(id) || identities.has(authUserId)) {
        return Promise.reject(new LinkConflict());
      }
      learners.set(id, { id, name });
      identities.set(authUserId, id);
      return Promise.resolve();
    },
  };

  const eventRepo: EventRepo = {
    insertMany: (learnerId, batch) => {
      const inserted: string[] = [];
      const ownedByOthers: string[] = [];
      for (const event of batch) {
        const existing = events.find((e) => e.id === event.id);
        if (existing && existing.learnerId !== learnerId) ownedByOthers.push(event.id);
        if (existing) continue;
        seq += 1;
        events.push({ ...structuredClone(event), seq });
        inserted.push(event.id);
      }
      return Promise.resolve({ inserted, ownedByOthers });
    },
    page: (learnerId, after, limit) =>
      Promise.resolve({
        events: events
          .filter((e) => e.learnerId === learnerId && e.seq > after)
          .slice(0, limit)
          .map((e) => structuredClone(e)),
      }),
  };

  const switchRepo: SwitchRepo = {
    allStudents: () => Promise.resolve(Object.fromEntries(allStudents)),
    overrides: (learnerId) => Promise.resolve(Object.fromEntries(overrides.get(learnerId) ?? [])),
  };

  const repos: MemoryRepos = {
    identities,
    learnerRows: learners,
    data: memoryLearnerData({ learners, identities, eventRepo, overrides }),
    learners: learnerRepo,
    events: eventRepo,
    switches: switchRepo,
    limiter: memoryRateLimiter(),
    recordings: memoryRecordingRepo(),
    branding: memoryBranding(),
    staff: memoryStaff(),
    audit: memoryAudit(),
    summaries: memorySummaries(eventRepo),
    org: memoryOrg(learners),
    storage: memoryRecordingStorage(),
    newAuthUser: () => Promise.resolve(randomUUID()),
    setAllStudents: (key, enabled) => {
      allStudents.set(key, enabled);
      return Promise.resolve();
    },
    setOverride: (learnerId, key, enabled) => {
      const mine = overrides.get(learnerId) ?? new Map<string, boolean>();
      mine.set(key, enabled);
      overrides.set(learnerId, mine);
      return Promise.resolve();
    },
    removeSwitch: (key) => {
      allStudents.delete(key);
      return Promise.resolve();
    },
    cleanup: () => Promise.resolve(),
    codes: undefined as unknown as CodeRepo,
    attendance: memoryAttendance(),
    auth: memoryAuth(),
    pepper: 'memory-test-pepper-0123456789abcdef',
  };
  repos.codes = memoryCodeRepo(repos);
  return repos;
}

export const makeMemoryFixture = (): Promise<ServiceFixture> => Promise.resolve(makeMemoryRepos());

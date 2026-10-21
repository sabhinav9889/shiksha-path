import type { LearnerEvent } from '@shiksha/learner-core';

export interface LearnerRow {
  id: string;
  name: string;
}

export interface LearnerRepo {
  findByAuthUser(authUserId: string): Promise<LearnerRow | null>;
  findById(id: string): Promise<LearnerRow | null>;
  /** Creates the learner and links the identity together, or neither. */
  createLinked(input: { id: string; name: string; authUserId: string }): Promise<void>;
}

export interface EventRepo {
  /**
   * Inserts the events that are new. `inserted` lists them; `ownedByOthers` lists ids that already
   * exist for a different learner. Any other id already existed for this learner (a retry).
   */
  insertMany(
    learnerId: string,
    events: LearnerEvent[],
  ): Promise<{ inserted: string[]; ownedByOthers: string[] }>;
  page(
    learnerId: string,
    after: number,
    limit: number,
  ): Promise<{ events: (LearnerEvent & { seq: number })[] }>;
}

export interface SwitchRepo {
  allStudents(): Promise<Record<string, boolean>>;
  overrides(learnerId: string): Promise<Record<string, boolean>>;
}

/** Verifies an access token; the identity comes from here, never from a request body. */
export interface Auth {
  verify(accessToken: string): Promise<{ authUserId: string } | null>;
}

import type { LearnerEvent } from '@shiksha/learner-core';

export interface LearnerRow {
  id: string;
  name: string;
}

/** Another request created the same learner or identity at the same moment. */
export class LinkConflict extends Error {
  constructor() {
    super('link conflict');
    this.name = 'LinkConflict';
  }
}

export interface LearnerRepo {
  findByAuthUser(authUserId: string): Promise<LearnerRow | null>;
  findById(id: string): Promise<LearnerRow | null>;
  /** Creates the learner and links the identity together, or neither. Throws `LinkConflict`. */
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

export interface RecordingRow {
  id: string;
  learnerId: string;
  lessonId: string;
  itemId: string;
  mime: string;
  bytes: number;
  durationMs: number;
  recordedAt: string;
  status: 'pending' | 'uploaded';
  uploadedAt: string | null;
  reviewedAt: string | null;
  /** When the upload was started (an old recording made offline can start uploading late). */
  createdAt: string;
}

export interface RecordingRepo {
  /** `exists`: this learner already has it; `ownedByOther`: the id is someone else's. */
  create(
    row: Omit<RecordingRow, 'status' | 'uploadedAt' | 'reviewedAt' | 'createdAt'>,
  ): Promise<'created' | 'exists' | 'ownedByOther'>;
  get(id: string): Promise<RecordingRow | null>;
  markUploaded(id: string, at: Date): Promise<void>;
  listByLearner(learnerId: string): Promise<RecordingRow[]>;
  /** Rows retention should remove at `now` (Task 10). */
  due(now: Date): Promise<RecordingRow[]>;
  delete(ids: string[]): Promise<void>;
}

/** Where recordings live (spec §5.5 rule 5): S3-style, so another store is one adapter. */
export interface RecordingStorage {
  signUpload(path: string): Promise<{ url: string; token: string }>;
  /** The stored object's size in bytes, or null when there is none. */
  size(path: string): Promise<number | null>;
  signDownload(path: string, seconds: number): Promise<string>;
  remove(paths: string[]): Promise<void>;
}

/** Counts actions per bucket in fixed windows. `false` means this one is over the limit. */
export interface RateLimiter {
  hit(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;
}

/** Who is calling: the auth user and how they signed in (`google`, or `email` for codes). */
export interface Caller {
  authUserId: string;
  provider: string;
}

/** Verifies an access token; the identity comes from here, never from a request body. */
export interface Auth {
  verify(accessToken: string): Promise<Caller | null>;
}

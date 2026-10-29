import type { Branding, BrandingInput, Session } from '@shiksha/api-contract';
import type { LearnerEvent } from '@shiksha/learner-core';
import type { Summary } from './services/summary.js';

export interface LearnerRow {
  id: string;
  name: string;
  /** Deactivated by an admin: their sync is refused, their data kept (spec §8.1). */
  deactivated?: boolean;
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
  setForAll(key: string, enabled: boolean): Promise<void>;
  /** `null` removes the override, so the all-students value applies again. */
  setOverride(learnerId: string, key: string, enabled: boolean | null): Promise<void>;
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
  /** A mentor's note on the recording (at most 280 characters), for mentors only. */
  comment: string | null;
  /** When the upload was started (an old recording made offline can start uploading late). */
  createdAt: string;
}

export interface RecordingRepo {
  /** `exists`: this learner already has it; `ownedByOther`: the id is someone else's. */
  create(
    row: Omit<RecordingRow, 'status' | 'uploadedAt' | 'reviewedAt' | 'createdAt' | 'comment'>,
  ): Promise<'created' | 'exists' | 'ownedByOther'>;
  get(id: string): Promise<RecordingRow | null>;
  markUploaded(id: string, at: Date): Promise<void>;
  listByLearner(learnerId: string): Promise<RecordingRow[]>;
  /** Rows retention should remove at `now` (Task 10). */
  due(now: Date): Promise<RecordingRow[]>;
  delete(ids: string[]): Promise<void>;
  /** Mark reviewed (the first review time stays) and set the comment; returns the review time. */
  review(id: string, staffId: string, comment: string | null, at: Date): Promise<string>;
  /** Uploaded, unreviewed recordings of these learners (everyone for 'all'), oldest first. */
  unreviewed(learnerIds: string[] | 'all'): Promise<RecordingRow[]>;
}

/** Where recordings live (spec §5.5 rule 5): S3-style, so another store is one adapter. */
export interface RecordingStorage {
  signUpload(path: string): Promise<{ url: string; token: string }>;
  /** The stored object's size in bytes, or null when there is none. */
  size(path: string): Promise<number | null>;
  signDownload(path: string, seconds: number): Promise<string>;
  /** The object's bytes (for an export), or null when there is none. */
  read(path: string): Promise<Uint8Array | null>;
  remove(paths: string[]): Promise<void>;
  /** Remove every object under `<prefix>/`; returns how many went. */
  removePrefix(prefix: string): Promise<number>;
}

/** What the server holds about one learner, for export and deletion (privacy rule). */
export interface LearnerRows {
  learner: {
    id: string;
    name: string;
    cohortId: string | null;
    createdAt: string;
    deactivated: boolean;
  };
  authUserIds: string[];
  events: LearnerEvent[];
  overrides: Record<string, boolean>;
}

export interface LearnerDataRepo {
  rows(learnerId: string): Promise<LearnerRows | null>;
  /** Delete the learner (everything cascades) and leave a tombstone, in one transaction. */
  deleteWithTombstone(learnerId: string): Promise<{ events: number }>;
  /** Which of these ids belong to students deleted on request. */
  deleted(ids: string[]): Promise<string[]>;
  /** Students deleted on request since this moment. */
  deletedSince(since: Date): Promise<string[]>;
}

/** The platform's name and colours: one row, versioned (spec §8.1 branding). */
export interface BrandingRepo {
  get(): Promise<Branding>;
  /** Save a checked change; returns the new version (the old one plus one). */
  set(input: BrandingInput): Promise<{ version: number }>;
}

/** Counts actions per bucket in fixed windows. `false` means this one is over the limit. */
export interface RateLimiter {
  hit(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** How many hits the current window holds, without adding one. */
  count(bucket: string, windowSeconds: number): Promise<number>;
}

/** Who is calling: the auth user and how they signed in (`google`, or `email` for codes). */
export interface Caller {
  authUserId: string;
  provider: string;
  /** Only to claim a staff invite; never logged or stored for learners. */
  email: string | null;
}

export type StaffRole = 'mentor' | 'admin';

export interface StaffRow {
  id: string;
  email: string;
  role: StaffRole;
  name: string;
  active: boolean;
  authUserId: string | null;
  cohortIds: string[];
}

/** Mentors and admins (spec §8). Invited by email; the first Google sign-in claims the row. */
export interface StaffRepo {
  byId(staffId: string): Promise<StaffRow | null>;
  byAuthUser(authUserId: string): Promise<StaffRow | null>;
  byEmail(email: string): Promise<StaffRow | null>;
  /** Bind an unclaimed invite to an auth user; false when someone claimed it first. */
  claim(staffId: string, authUserId: string): Promise<boolean>;
  save(row: Omit<StaffRow, 'id' | 'authUserId'> & { id?: string }): Promise<string>;
  list(): Promise<StaffRow[]>;
}

export type AuditDetails = Record<string, string | number | boolean | null>;

export interface AuditEntry {
  id: number;
  staffId: string | null;
  action: string;
  learnerId: string | null;
  details: AuditDetails;
  at: string;
}

/** Every staff action, kept until the NGO deletes it (spec §8.1 audit log). */
export interface AuditRepo {
  add(entry: Omit<AuditEntry, 'id' | 'at'>): Promise<void>;
  /** Newest first, entries with an id below `before` (all when null). */
  page(before: number | null, limit: number): Promise<AuditEntry[]>;
  /** A learner deleted on request: their entries keep no id (privacy rule). */
  anonymiseLearner(learnerId: string): Promise<void>;
}

/** Per-learner progress summaries for staff screens, re-derived after every upload. */
export interface SummaryRepo {
  /**
   * Re-derive one learner's summary from their whole log and store it. Refreshes of one learner
   * never interleave, so the last one always sees every committed event.
   */
  refresh(learnerId: string, derive: (events: unknown[]) => Summary): Promise<Summary>;
  forLearners(ids: string[]): Promise<Map<string, Summary>>;
}

/** Lab attendance: one mark per learner per IST day (spec §8 mentor actions). */
export interface AttendanceRepo {
  /** Replace the marks of these learners for `day`: present if listed, absent otherwise. */
  markDay(input: {
    learnerIds: string[];
    present: ReadonlySet<string>;
    day: string;
    staffId: string;
  }): Promise<number>;
  /** A learner's marks since `fromDay` (inclusive), newest first. */
  forLearner(learnerId: string, fromDay: string): Promise<{ date: string; present: boolean }[]>;
}

/** Labs, cohorts and which cohort a learner is in. */
export type DeleteResult = 'deleted' | 'not_empty' | 'missing';

export interface OrgRepo {
  saveLab(lab: { id?: string; name: string }): Promise<string>;
  saveCohort(cohort: { id?: string; name: string; labId: string | null }): Promise<string>;
  /** Only a lab with no cohorts is deleted; the check and the delete are one statement. */
  deleteLab(id: string): Promise<DeleteResult>;
  /** Only a cohort with no learners (paused ones count) is deleted. Mentor links go with it. */
  deleteCohort(id: string): Promise<DeleteResult>;
  setLearnerCohort(learnerId: string, cohortId: string | null): Promise<void>;
  cohortOfLearner(learnerId: string): Promise<string | null | undefined>;
  cohorts(ids: string[] | 'all'): Promise<{ id: string; name: string; labId: string | null }[]>;
  labs(): Promise<{ id: string; name: string }[]>;
  setDeactivated(learnerId: string, deactivated: boolean): Promise<void>;
  renameLearner(learnerId: string, name: string): Promise<void>;
  /** Admin search: name contains `q` (literal text), optional cohort filter, by name, paged.
   * `after` is the id of the last learner of the previous page. */
  search(filter: {
    q?: string;
    cohortIds?: string[];
    active?: boolean;
    after?: string;
    limit: number;
  }): Promise<StudentRow[]>;
  /** Learners in these cohorts (everyone for 'all'), for staff screens. */
  students(cohortIds: string[] | 'all'): Promise<StudentRow[]>;
  student(learnerId: string): Promise<StudentRow | null>;
}

export interface StudentRow {
  id: string;
  name: string;
  cohortId: string | null;
  deactivated: boolean;
  /** IST day the learner was created (linked): "inactive" counts from here before any activity. */
  linkedOn: string;
  /** When the server last received an event from them. */
  lastSyncedAt: string | null;
}

/** Verifies an access token; the identity comes from here, never from a request body. */
export interface Auth {
  verify(accessToken: string): Promise<Caller | null>;
}

/** Auth could not answer (busy, down, its own limit): not the same as a wrong password. */
export class AuthUnavailable extends Error {
  constructor() {
    super('auth unavailable');
    this.name = 'AuthUnavailable';
  }
}

/** The auth users behind backup codes: made only by the server (Plan 3b). */
export interface CodeAuth {
  /** A new email user with a made-up address and this password. */
  createCodeUser(password: string): Promise<{ authUserId: string; email: string }>;
  deleteUser(authUserId: string): Promise<void>;
  /** The auth user's email (for an export), or null when the user is gone. */
  emailOf(authUserId: string): Promise<string | null>;
  /** Null for a wrong password; throws `AuthUnavailable` when Auth cannot answer. */
  signInWithPassword(email: string, password: string): Promise<Session | null>;
}

export interface CodeRow {
  learnerId: string;
  lookup: string;
  authUserId: string;
  authEmail: string;
}

export interface CodeRepo {
  findByLookup(lookup: string): Promise<CodeRow | null>;
  forLearner(learnerId: string): Promise<CodeRow | null>;
  /** The auth user linked to a learner, by code or by Google; null when none. */
  identityOf(learnerId: string): Promise<string | null>;
  /** A new learner, their identity and their code, together or not at all. */
  createLearnerWithCode(row: CodeRow & { name: string }): Promise<void>;
  /** An identity and a code for a learner who has neither. */
  addCode(row: CodeRow): Promise<void>;
  /** Point the learner's code and identity at a new auth user. */
  replace(row: CodeRow): Promise<void>;
}

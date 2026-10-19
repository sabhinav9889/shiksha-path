import Dexie, { type Table } from 'dexie';
import type { LearnerEvent, Profile } from '@shiksha/learner-core';
import type { Recording } from './recording-store.js';

/** One row per stored thing; `value` and `bundle` are validated again when read. */
export class ShikshaDb extends Dexie {
  // `declare` keeps the class field from overwriting the table Dexie creates.
  declare manifest: Table<{ id: string; value: unknown }, string>;
  declare modules: Table<{ id: string; version: string; bundle: unknown }, string>;
  declare placement: Table<{ id: string; version: string; bundle: unknown }, string>;
  declare audio: Table<{ path: string; bytes: Uint8Array }, string>;
  declare partials: Table<{ key: string; bytes: Uint8Array }, string>;
  declare events: Table<LearnerEvent & { seq?: number }, number>;
  declare sent: Table<{ id: string }, string>;
  declare meta: Table<{ key: string; value: string }, string>;
  declare profiles: Table<Profile, string>;
  declare recordings: Table<Recording, string>;

  constructor(name = 'shiksha') {
    super(name);
    this.version(1).stores({
      manifest: 'id',
      modules: 'id',
      placement: 'id',
      audio: 'path',
      partials: 'key',
      events: '++seq, &id, learnerId',
      sent: 'id',
      meta: 'key',
      profiles: 'id, createdAt',
    });
    // Version 2 adds speaking recordings; every version-1 table is kept as it is.
    this.version(2).stores({ recordings: 'id, learnerId, [learnerId+lessonId+itemId]' });
  }
}

import type { EventStore, LearnerEvent } from '@shiksha/learner-core';
import type { ShikshaDb } from './db.js';

/** Append order comes from an auto-increment `seq`; acknowledged ids live in their own table. */
export class IdbEventStore implements EventStore {
  constructor(private readonly db: ShikshaDb) {}

  async append(event: LearnerEvent): Promise<void> {
    try {
      await this.db.events.add({ ...event });
    } catch (error) {
      if ((error as { name?: string }).name !== 'ConstraintError') throw error;
      // The same event id again: idempotent, nothing to do.
    }
  }

  async all(learnerId: string): Promise<LearnerEvent[]> {
    const rows = await this.db.events.where('learnerId').equals(learnerId).sortBy('seq');
    return rows.map((row) => {
      const event: Partial<typeof row> = { ...row };
      delete event.seq;
      return event as LearnerEvent;
    });
  }

  async pending(learnerId: string, limit: number): Promise<LearnerEvent[]> {
    const events = await this.all(learnerId);
    const acknowledged = await this.db.sent.bulkGet(events.map((e) => e.id));
    return events.filter((_, i) => acknowledged[i] === undefined).slice(0, limit);
  }

  /**
   * Events that came from the server: stored once and never uploaded again.
   * Returns how many were new to this phone (its own uploads come back too).
   */
  async appendSent(events: LearnerEvent[]): Promise<number> {
    let added = 0;
    await this.db.transaction('rw', this.db.events, this.db.sent, async () => {
      for (const event of events) {
        const exists = await this.db.events.where('id').equals(event.id).count();
        if (exists > 0) continue;
        await this.db.events.add({ ...event });
        added += 1;
      }
      await this.db.sent.bulkPut(events.map((e) => ({ id: e.id })));
    });
    return added;
  }

  /** Remove every setting kept for a profile (keys end in `:<profileId>`). */
  async removeMetaFor(profileId: string): Promise<void> {
    const suffix = `:${profileId}`;
    await this.db.meta.filter((row) => row.key.endsWith(suffix)).delete();
  }

  /** Remove a learner's events from this phone (the profile was replaced or removed). */
  async removeLearner(learnerId: string): Promise<void> {
    await this.db.events.where('learnerId').equals(learnerId).delete();
  }

  async markSent(ids: string[]): Promise<void> {
    await this.db.sent.bulkPut(ids.map((id) => ({ id })));
  }

  async getMeta(key: string): Promise<string | null> {
    return (await this.db.meta.get(key))?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.meta.put({ key, value });
  }
}

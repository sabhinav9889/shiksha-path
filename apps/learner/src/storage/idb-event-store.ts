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

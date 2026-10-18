import type { LearnerEvent } from '../events.js';
import type { EventStore } from '../outbox.js';

export class MemoryEventStore implements EventStore {
  private readonly events = new Map<string, LearnerEvent>();
  private readonly sent = new Set<string>();
  private readonly meta = new Map<string, string>();

  append(event: LearnerEvent): Promise<void> {
    if (!this.events.has(event.id)) this.events.set(event.id, structuredClone(event));
    return Promise.resolve();
  }

  all(learnerId: string): Promise<LearnerEvent[]> {
    const own = [...this.events.values()].filter((e) => e.learnerId === learnerId);
    return Promise.resolve(structuredClone(own));
  }

  async pending(learnerId: string, limit: number): Promise<LearnerEvent[]> {
    const unsent = (await this.all(learnerId)).filter((e) => !this.sent.has(e.id));
    return unsent.slice(0, limit);
  }

  markSent(ids: string[]): Promise<void> {
    for (const id of ids) this.sent.add(id);
    return Promise.resolve();
  }

  getMeta(key: string): Promise<string | null> {
    return Promise.resolve(this.meta.get(key) ?? null);
  }

  setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
    return Promise.resolve();
  }
}

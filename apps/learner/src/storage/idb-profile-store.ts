import type { Profile, ProfileStore } from '@shiksha/learner-core';
import type { ShikshaDb } from './db.js';

export class IdbProfileStore implements ProfileStore {
  constructor(private readonly db: ShikshaDb) {}

  list(): Promise<Profile[]> {
    return this.db.profiles.orderBy('createdAt').toArray();
  }

  async get(id: string): Promise<Profile | null> {
    return (await this.db.profiles.get(id)) ?? null;
  }

  async put(profile: Profile): Promise<void> {
    await this.db.profiles.put(profile);
  }

  async delete(id: string): Promise<void> {
    await this.db.profiles.delete(id);
  }
}

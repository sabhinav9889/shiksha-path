import type { Profile, ProfileStore } from '../profiles.js';

export class MemoryProfileStore implements ProfileStore {
  private readonly profiles = new Map<string, Profile>();

  list(): Promise<Profile[]> {
    const all = [...this.profiles.values()].map((p) => structuredClone(p));
    return Promise.resolve(all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }

  get(id: string): Promise<Profile | null> {
    const found = this.profiles.get(id);
    return Promise.resolve(found ? structuredClone(found) : null);
  }

  put(profile: Profile): Promise<void> {
    this.profiles.set(profile.id, structuredClone(profile));
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.profiles.delete(id);
    return Promise.resolve();
  }
}

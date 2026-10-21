import type { ShikshaDb } from '../storage/db.js';

/**
 * Where Supabase Auth keeps a sign-in session: one per profile (spec §5.3), so learners sharing a
 * phone never share a Google session. The PIN keeps each profile's session to its owner.
 */
export class IdbAuthStorage {
  constructor(
    private readonly db: ShikshaDb,
    private readonly profileId: string,
  ) {}

  private key(name: string): string {
    return `${this.profileId}:${name}`;
  }

  async getItem(name: string): Promise<string | null> {
    return (await this.db.auth.get(this.key(name)))?.value ?? null;
  }

  async setItem(name: string, value: string): Promise<void> {
    await this.db.auth.put({ key: this.key(name), value });
  }

  async removeItem(name: string): Promise<void> {
    await this.db.auth.delete(this.key(name));
  }
}

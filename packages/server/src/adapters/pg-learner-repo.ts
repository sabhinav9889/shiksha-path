import { LinkConflict, type LearnerRepo, type LearnerRow } from '../ports.js';

const UNIQUE_VIOLATION = '23505';
import type { Sql } from './pg.js';

export class PgLearnerRepo implements LearnerRepo {
  constructor(private readonly sql: Sql) {}

  async findByAuthUser(authUserId: string): Promise<LearnerRow | null> {
    const rows = await this.sql<LearnerRow[]>`
      select l.id, l.name from learners l
      join learner_identities i on i.learner_id = l.id
      where i.auth_user_id = ${authUserId}`;
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<LearnerRow | null> {
    const rows = await this.sql<LearnerRow[]>`select id, name from learners where id = ${id}`;
    return rows[0] ?? null;
  }

  async createLinked(input: { id: string; name: string; authUserId: string }): Promise<void> {
    try {
      await this.sql.begin(async (tx) => {
        await tx`insert into learners (id, name) values (${input.id}, ${input.name})`;
        await tx`insert into learner_identities (auth_user_id, learner_id)
                 values (${input.authUserId}, ${input.id})`;
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new LinkConflict();
      throw error;
    }
  }
}

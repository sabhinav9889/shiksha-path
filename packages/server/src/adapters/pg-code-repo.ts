import type { CodeRepo, CodeRow } from '../ports.js';
import type { Sql } from './pg.js';

interface Row {
  learner_id: string;
  lookup: string;
  auth_user_id: string;
  auth_email: string;
}

const toRow = (r: Row): CodeRow => ({
  learnerId: r.learner_id,
  lookup: r.lookup,
  authUserId: r.auth_user_id,
  authEmail: r.auth_email,
});

export class PgCodeRepo implements CodeRepo {
  constructor(private readonly sql: Sql) {}

  async findByLookup(lookup: string): Promise<CodeRow | null> {
    const rows = await this.sql<Row[]>`select * from login_codes where lookup = ${lookup}`;
    return rows[0] ? toRow(rows[0]) : null;
  }

  async forLearner(learnerId: string): Promise<CodeRow | null> {
    const rows = await this.sql<Row[]>`select * from login_codes where learner_id = ${learnerId}`;
    return rows[0] ? toRow(rows[0]) : null;
  }

  async identityOf(learnerId: string): Promise<string | null> {
    const rows = await this.sql<{ auth_user_id: string }[]>`
      select auth_user_id from learner_identities where learner_id = ${learnerId}`;
    return rows[0]?.auth_user_id ?? null;
  }

  async createLearnerWithCode(row: CodeRow & { name: string }): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`insert into learners (id, name) values (${row.learnerId}, ${row.name})`;
      await tx`insert into learner_identities (auth_user_id, learner_id)
               values (${row.authUserId}, ${row.learnerId})`;
      await tx`insert into login_codes (learner_id, lookup, auth_user_id, auth_email)
               values (${row.learnerId}, ${row.lookup}, ${row.authUserId}, ${row.authEmail})`;
    });
  }

  async addCode(row: CodeRow): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`insert into learner_identities (auth_user_id, learner_id)
               values (${row.authUserId}, ${row.learnerId})`;
      await tx`insert into login_codes (learner_id, lookup, auth_user_id, auth_email)
               values (${row.learnerId}, ${row.lookup}, ${row.authUserId}, ${row.authEmail})`;
    });
  }

  async replace(row: CodeRow): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`update learner_identities set auth_user_id = ${row.authUserId}
               where learner_id = ${row.learnerId}`;
      await tx`update login_codes
               set lookup = ${row.lookup}, auth_user_id = ${row.authUserId},
                   auth_email = ${row.authEmail}
               where learner_id = ${row.learnerId}`;
    });
  }
}

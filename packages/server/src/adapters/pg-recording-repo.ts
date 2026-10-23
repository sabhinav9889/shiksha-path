import type { RecordingRepo, RecordingRow } from '../ports.js';
import type { Sql } from './pg.js';

interface Row {
  id: string;
  learner_id: string;
  lesson_id: string;
  item_id: string;
  mime: string;
  bytes: number;
  duration_ms: number;
  recorded_at: Date;
  status: 'pending' | 'uploaded';
  uploaded_at: Date | null;
  reviewed_at: Date | null;
  review_comment: string | null;
  created_at: Date;
}

const toRow = (r: Row): RecordingRow => ({
  id: r.id,
  learnerId: r.learner_id,
  lessonId: r.lesson_id,
  itemId: r.item_id,
  mime: r.mime,
  bytes: r.bytes,
  durationMs: r.duration_ms,
  recordedAt: r.recorded_at.toISOString(),
  status: r.status,
  uploadedAt: r.uploaded_at?.toISOString() ?? null,
  reviewedAt: r.reviewed_at?.toISOString() ?? null,
  comment: r.review_comment,
  createdAt: r.created_at.toISOString(),
});

export class PgRecordingRepo implements RecordingRepo {
  constructor(private readonly sql: Sql) {}

  async create(
    row: Omit<RecordingRow, 'status' | 'uploadedAt' | 'reviewedAt' | 'createdAt' | 'comment'>,
  ): Promise<'created' | 'exists' | 'ownedByOther'> {
    const inserted = await this.sql`
      insert into recordings (id, learner_id, lesson_id, item_id, mime, bytes, duration_ms,
                              recorded_at)
      values (${row.id}, ${row.learnerId}, ${row.lessonId}, ${row.itemId}, ${row.mime},
              ${row.bytes}, ${row.durationMs}, ${row.recordedAt})
      on conflict (id) do nothing
      returning id`;
    if (inserted.length > 0) return 'created';
    const owner = await this.sql<{ learner_id: string }[]>`
      select learner_id from recordings where id = ${row.id}`;
    return owner[0]?.learner_id === row.learnerId ? 'exists' : 'ownedByOther';
  }

  async get(id: string): Promise<RecordingRow | null> {
    const rows = await this.sql<Row[]>`select * from recordings where id = ${id}`;
    return rows[0] ? toRow(rows[0]) : null;
  }

  async markUploaded(id: string, at: Date): Promise<void> {
    await this.sql`
      update recordings set status = 'uploaded', uploaded_at = ${at} where id = ${id}`;
  }

  async listByLearner(learnerId: string): Promise<RecordingRow[]> {
    const rows = await this.sql<Row[]>`
      select * from recordings where learner_id = ${learnerId} order by recorded_at`;
    return rows.map(toRow);
  }

  /** Reviewed > 30 days ago, uploaded and unreviewed > 90 days, or started > 7 days ago. */
  async due(now: Date): Promise<RecordingRow[]> {
    const rows = await this.sql<Row[]>`
      select * from recordings
      where (reviewed_at is not null and reviewed_at < ${now}::timestamptz - interval '30 days')
         or (reviewed_at is null and status = 'uploaded'
             and uploaded_at < ${now}::timestamptz - interval '90 days')
         or (status = 'pending' and created_at < ${now}::timestamptz - interval '7 days')`;
    return rows.map(toRow);
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.sql`
      delete from recordings
      where id in (select value::uuid from jsonb_array_elements_text(${this.sql.json(ids)}))`;
  }

  async review(id: string, staffId: string, comment: string | null, at: Date): Promise<string> {
    const [row] = await this.sql<{ reviewed_at: Date }[]>`
      update recordings
      set reviewed_at = coalesce(reviewed_at, ${at}), reviewed_by = ${staffId},
          review_comment = ${comment}
      where id = ${id}
      returning reviewed_at`;
    if (!row) throw new Error('no such recording');
    return row.reviewed_at.toISOString();
  }

  async unreviewed(learnerIds: string[] | 'all'): Promise<RecordingRow[]> {
    const ids = this.sql.json(learnerIds === 'all' ? [] : learnerIds);
    const rows = await this.sql<Row[]>`
      select * from recordings
      where status = 'uploaded' and reviewed_at is null
        and (${learnerIds === 'all'} or learner_id in
              (select value::uuid from jsonb_array_elements_text(${ids})))
      order by uploaded_at`;
    return rows.map(toRow);
  }
}

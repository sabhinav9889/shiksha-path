import { randomUUID } from 'node:crypto';
import type { PostRepo, PostRow, StaffRepo } from '../ports.js';

/** In-memory posts; the staff repository gives the author names, as the Postgres join does. */
export function memoryPosts(staff: StaffRepo): PostRepo {
  const rows = new Map<string, PostRow>();
  // Newest first, ties broken by id, as `order by created_at desc, id desc`.
  const newest = (a: PostRow, b: PostRow): number =>
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
  /** The row as read: an author who is gone is null, one who is paused has no name. */
  const read = async (row: PostRow): Promise<PostRow> => {
    const author = row.authorId ? await staff.byId(row.authorId) : null;
    return {
      ...structuredClone(row),
      authorId: author ? row.authorId : null,
      authorName: author?.active ? author.name : null,
    };
  };
  const readAll = (matching: (row: PostRow) => boolean, limit: number): Promise<PostRow[]> =>
    Promise.all([...rows.values()].filter(matching).sort(newest).slice(0, limit).map(read));
  return {
    save(post, at) {
      const id = post.id ?? randomUUID();
      const before = rows.get(id);
      rows.set(id, {
        id,
        authorId: before?.authorId ?? post.authorId,
        authorName: null,
        cohortId: post.cohortId,
        title: post.title,
        body: post.body,
        session: post.session ? { ...post.session } : null,
        createdAt: before?.createdAt ?? at.toISOString(),
        editedAt: before ? at.toISOString() : null,
      });
      return Promise.resolve(id);
    },
    get: async (id) => {
      const row = rows.get(id);
      return row ? read(row) : null;
    },
    feed: (cohortId, limit) =>
      readAll((row) => row.cohortId === null || row.cohortId === cohortId, limit),
    list: ({ cohortIds, authorId }, limit) =>
      readAll(
        (row) =>
          cohortIds === 'all' ||
          row.authorId === authorId ||
          row.cohortId === null ||
          cohortIds.includes(row.cohortId),
        limit,
      ),
    delete: (id) => Promise.resolve(rows.delete(id)),
  };
}

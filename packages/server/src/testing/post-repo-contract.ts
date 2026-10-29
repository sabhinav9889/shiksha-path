import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import type { PostInput } from '../ports.js';
import type { ServiceFixture } from './service-contract.js';
import { staffWorld } from './staff-world.js';

const CAP = 30;

/** The post repository (spec §10.2), against any set of repositories. */
export function describePostRepoContract(name: string, make: () => Promise<ServiceFixture>): void {
  describe(`posts over ${name}`, () => {
    const w = staffWorld(make);
    // A real database is shared with other tests: our posts carry a tag, are newer than any
    // existing one, and are removed afterwards.
    const tag = randomUUID().slice(0, 8);
    const start = Date.now();
    let tick = 0;
    const made: string[] = [];
    /** Each post is a minute after the last, so "newest first" has no ties. */
    const at = (): Date => new Date(start + tick++ * 60_000);
    const input = (author: string, cohortId: string | null, title: string): PostInput => ({
      authorId: author,
      cohortId,
      title: `${tag}-${title}`,
      body: '',
      session: null,
    });
    /** Save and remember the post so it is removed after the test. */
    const save = async (post: PostInput, when: Date): Promise<string> => {
      const id = await w.f.posts.save(post, when);
      made.push(id);
      return id;
    };
    const titles = (rows: { title: string }[]): string[] =>
      rows.filter((r) => r.title.startsWith(tag)).map((r) => r.title.slice(tag.length + 1));
    afterEach(async () => {
      for (const id of made.splice(0)) await w.f.posts.delete(id);
    });

    test('a student feed holds everyone and their own cohort, newest first, capped', async () => {
      const author = (await w.staffMember('admin', [])).staffId;
      for (let i = 0; i < CAP + 1; i++) {
        await save(input(author, null, `all-${i}`), at());
      }
      await save(input(author, w.cohortB, 'only-b'), at());
      await save(input(author, w.cohortA, 'only-a'), at());
      const feedA = titles(await w.f.posts.feed(w.cohortA, CAP));
      expect(feedA).toHaveLength(CAP);
      expect(feedA.slice(0, 3)).toEqual(['only-a', 'all-30', 'all-29']);
      expect(feedA).not.toContain('only-b');
      expect(feedA).not.toContain('all-0'); // the 31st oldest is cut
      expect(titles(await w.f.posts.feed(null, CAP))).not.toContain('only-a');
      expect(titles(await w.f.posts.feed(w.cohortB, 2))).toEqual(['only-b', 'all-30']);
    });

    test('a mentor lists their cohorts, everyone and their own; an admin lists all', async () => {
      const mentorA = await w.staffMember('mentor', [w.cohortA]);
      const mentorB = await w.staffMember('mentor', [w.cohortB]);
      const admin = await w.staffMember('admin', []);
      await save(input(admin.staffId, null, 'all'), at());
      await save(input(mentorA.staffId, w.cohortA, 'a-by-a'), at());
      await save(input(mentorB.staffId, w.cohortB, 'b-by-b'), at());
      await save(input(admin.staffId, w.cohortB, 'b-by-admin'), at());
      const asA = { cohortIds: [w.cohortA], authorId: mentorA.staffId };
      expect(titles(await w.f.posts.list(asA, 50))).toEqual(['a-by-a', 'all']);
      const asB = { cohortIds: [w.cohortB], authorId: mentorB.staffId };
      expect(titles(await w.f.posts.list(asB, 50))).toEqual(['b-by-admin', 'b-by-b', 'all']);
      const asAdmin = { cohortIds: 'all' as const, authorId: admin.staffId };
      expect(titles(await w.f.posts.list(asAdmin, 50))).toHaveLength(4);
      expect(await w.f.posts.list(asAdmin, 2)).toHaveLength(2);
      // A mentor still reads their own post after leaving its cohort.
      const moved = { cohortIds: [w.cohortB], authorId: mentorA.staffId };
      expect(titles(await w.f.posts.list(moved, 50))).toEqual([
        'b-by-admin',
        'b-by-b',
        'a-by-a',
        'all',
      ]);
    });

    test('an edit keeps the date, sets editedAt and round-trips the session', async () => {
      const author = (await w.staffMember('admin', [])).staffId;
      const session = {
        startsAt: '2026-11-10T04:30:00.000Z',
        minutes: 45,
        link: 'https://x.org/a',
      };
      const id = await save({ ...input(author, null, 'Talk'), session }, at());
      const first = await w.f.posts.get(id);
      expect(first?.editedAt).toBeNull();
      expect(first?.session).toEqual(session);
      await save({ ...input(author, w.cohortA, 'Talk 2'), id, body: 'new' }, at());
      const edited = await w.f.posts.get(id);
      expect(edited).toMatchObject({
        title: `${tag}-Talk 2`,
        body: 'new',
        cohortId: w.cohortA,
        session: null,
      });
      expect(edited?.createdAt).toBe(first?.createdAt);
      expect(edited?.editedAt).not.toBeNull();
    });

    test('a deleted post is gone; deleting it again or an unknown id says so', async () => {
      const author = (await w.staffMember('admin', [])).staffId;
      const id = await save(input(author, null, 'x'), at());
      expect(await w.f.posts.delete(id)).toBe(true);
      expect(await w.f.posts.get(id)).toBeNull();
      expect(titles(await w.f.posts.feed(null, CAP))).toEqual([]);
      expect(await w.f.posts.delete(id)).toBe(false);
      expect(await w.f.posts.delete(randomUUID())).toBe(false);
    });

    test('the author shows while active; paused or deleted staff leave the post nameless', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const id = await save(input(mentor.staffId, w.cohortA, 'x'), at());
      expect((await w.f.posts.get(id))?.authorName).toBe('mentor');
      const row = await w.f.staff.byId(mentor.staffId);
      if (!row) throw new Error('no staff row');
      await w.f.staff.save({ ...row, active: false });
      expect(await w.f.posts.get(id)).toMatchObject({ authorName: null, authorId: mentor.staffId });
      await w.f.staff.save({ ...row, active: true });
      await w.f.staff.delete(mentor.staffId);
      expect(await w.f.posts.get(id)).toMatchObject({ authorName: null, authorId: null });
      expect(titles(await w.f.posts.feed(w.cohortA, CAP))).toEqual(['x']); // the post stays
    });
  });
}

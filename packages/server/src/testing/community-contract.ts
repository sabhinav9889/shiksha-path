import { randomUUID } from 'node:crypto';
import type { PostRequest } from '@shiksha/api-contract/staff';
import { afterEach, describe, expect, test } from 'vitest';
import * as admin from '../services/admin.js';
import { listAudit } from '../services/audit.js';
import { deletePost, getFeed, listStaffPosts, savePost } from '../services/community.js';
import type { ServiceFixture } from './service-contract.js';
import { codeOf, staffWorld } from './staff-world.js';

/** Mentors write posts, students read them (spec §10.2), against any set of repositories. */
export function describeCommunityContract(name: string, make: () => Promise<ServiceFixture>): void {
  describe(`community over ${name}`, () => {
    const w = staffWorld(make);
    const { staffMember, learnerAuth } = w;
    const tag = randomUUID().slice(0, 8);
    const made: string[] = [];
    const start = Date.now();
    let tick = 0;
    const post = (cohortId: string | null, title: string): PostRequest => ({
      title: `${tag}-${title}`,
      body: 'Bring a pen. <b>not markup</b>',
      audience: cohortId ? { kind: 'cohort', cohortId } : { kind: 'all' },
      session: null,
    });
    const save = async (
      who: Awaited<ReturnType<typeof staffMember>>,
      body: PostRequest,
    ): Promise<string> => {
      const id = await savePost(w.f, who, body, new Date(start + tick++ * 1000));
      made.push(id);
      return id;
    };
    afterEach(async () => {
      for (const id of made.splice(0)) await w.f.posts.delete(id);
    });
    const mine = (rows: { title: string }[]): string[] =>
      rows.filter((r) => r.title.startsWith(tag)).map((r) => r.title.slice(tag.length + 1));
    const feedOf = async (learnerId: string): Promise<string[]> =>
      mine((await getFeed(w.f, await learnerAuth(learnerId))).posts);
    const listOf = async (who: Awaited<ReturnType<typeof staffMember>>): Promise<string[]> =>
      mine((await listStaffPosts(w.f, who)).posts);

    test('a mentor posts to their own cohort only; an admin posts anywhere, to real cohorts', async () => {
      const mentor = await staffMember('mentor', [w.cohortA]);
      const boss = await staffMember('admin', []);
      await save(mentor, post(w.cohortA, 'mine'));
      expect(await codeOf(savePost(w.f, mentor, post(w.cohortB, 'other')))).toBe('FORBIDDEN');
      expect(await codeOf(savePost(w.f, mentor, post(null, 'all')))).toBe('FORBIDDEN');
      await save(boss, post(null, 'all'));
      await save(boss, post(w.cohortB, 'b'));
      expect(await codeOf(savePost(w.f, boss, post(randomUUID(), 'x')))).toBe('INVALID_REQUEST');
      expect(await listOf(boss)).toEqual(['b', 'all', 'mine']);
    });

    test('edits and deletes: the author, in scope; an admin deletes any but edits only their own', async () => {
      const mentorA = await staffMember('mentor', [w.cohortA]);
      const mentorB = await staffMember('mentor', [w.cohortB]);
      const boss = await staffMember('admin', []);
      const id = await save(mentorA, post(w.cohortA, 'a'));
      const edit = (who: typeof mentorA, postId: string): Promise<string> =>
        savePost(w.f, who, { ...post(w.cohortA, 'a2'), id: postId });
      expect(await codeOf(edit(mentorB, id))).toBe('FORBIDDEN');
      expect(await codeOf(edit(boss, id))).toBe('FORBIDDEN');
      expect(await codeOf(edit(mentorA, randomUUID()))).toBe('FORBIDDEN');
      expect(await codeOf(deletePost(w.f, mentorB, { id }))).toBe('FORBIDDEN');
      expect(await codeOf(deletePost(w.f, mentorA, { id: randomUUID() }))).toBe('FORBIDDEN');
      await edit(mentorA, id);
      expect((await w.f.posts.get(id))?.editedAt).not.toBeNull();
      await deletePost(w.f, boss, { id });
      expect(await w.f.posts.get(id)).toBeNull();
      const own = await save(boss, post(null, 'own'));
      await savePost(w.f, boss, { ...post(null, 'own2'), id: own });
      expect(await listOf(boss)).toEqual(['own2']);
    });

    test('a mentor who left the cohort keeps the post in the feed but cannot change it', async () => {
      const mentor = await staffMember('mentor', [w.cohortA]);
      const id = await save(mentor, post(w.cohortA, 'kept'));
      const moved = { ...mentor, cohortIds: [w.cohortB] }; // the caller as read after a move
      expect(await codeOf(savePost(w.f, moved, { ...post(w.cohortA, 'x'), id }))).toBe('FORBIDDEN');
      expect(await codeOf(deletePost(w.f, moved, { id }))).toBe('FORBIDDEN');
      expect(await feedOf(w.learnerA)).toEqual(['kept']);
      const listed = (await listStaffPosts(w.f, moved)).posts.find((p) => p.id === id);
      expect(listed).toMatchObject({ canEdit: false, canDelete: false });
    });

    test('every write leaves one audit entry with ids only, never the title or body', async () => {
      const boss = await staffMember('admin', []);
      const id = await save(boss, post(w.cohortA, 'secret title'));
      await savePost(w.f, boss, { ...post(w.cohortA, 'secret title 2'), id });
      await deletePost(w.f, boss, { id });
      const entries = (await listAudit(w.f, boss, null, 100)).entries.slice(0, 3);
      expect(entries.map((e) => e.action)).toEqual(['post_deleted', 'post_edited', 'post_created']);
      expect(entries.every((e) => e.details['postId'] === id)).toBe(true);
      expect(entries[2]?.details).toEqual({ postId: id, audience: 'cohort', cohortId: w.cohortA });
      expect(JSON.stringify(entries)).not.toMatch(/secret|Bring a pen/);
    });

    test('a student reads everyone and their cohort, never another cohort; no cohort means everyone only', async () => {
      const boss = await staffMember('admin', []);
      await save(boss, post(null, 'all'));
      await save(boss, post(w.cohortA, 'a'));
      await save(boss, post(w.cohortB, 'b'));
      expect(await feedOf(w.learnerA)).toEqual(['a', 'all']);
      expect(await feedOf(w.learnerB)).toEqual(['b', 'all']);
      const feed = await getFeed(w.f, await learnerAuth(w.learnerA));
      expect(feed.posts.find((p) => p.title.endsWith('-a'))?.toCohort).toBe(true);
      expect(feed.posts.find((p) => p.title.endsWith('-all'))?.toCohort).toBe(false);
      await w.f.org.setLearnerCohort(w.learnerA, null);
      expect(await feedOf(w.learnerA)).toEqual(['all']);
      await w.f.org.setLearnerCohort(w.learnerA, w.cohortB);
      expect(await feedOf(w.learnerA)).toEqual(['b', 'all']);
    });

    test('the feed is refused when the switch is off for that student, and for a paused one', async () => {
      const boss = await staffMember('admin', []);
      await save(boss, post(null, 'all'));
      await w.f.setOverride(w.learnerA, 'community_feed', false);
      const authA = await learnerAuth(w.learnerA);
      expect(await codeOf(getFeed(w.f, authA))).toBe('FEATURE_OFF');
      expect(await feedOf(w.learnerB)).toEqual(['all']);
      await w.f.setOverride(w.learnerA, 'community_feed', true);
      await admin.setActive(w.f, boss, { learnerId: w.learnerA, active: false });
      expect(await codeOf(getFeed(w.f, authA))).toBe('DEACTIVATED');
      expect(await codeOf(getFeed(w.f, randomUUID()))).toBe('NOT_LINKED');
    });

    test('a post whose author is gone stays, with no name', async () => {
      const mentor = await staffMember('mentor', [w.cohortA]);
      await save(mentor, post(w.cohortA, 'orphan'));
      expect((await getFeed(w.f, await learnerAuth(w.learnerA))).posts[0]?.authorName).toBe(
        'mentor',
      );
      await w.f.staff.delete(mentor.staffId);
      const [first] = (await getFeed(w.f, await learnerAuth(w.learnerA))).posts;
      expect(first?.title).toBe(`${tag}-orphan`);
      expect(first?.authorName).toBeNull();
    });
  });
}

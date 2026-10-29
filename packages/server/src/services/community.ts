import { FEED_CAP, type FeedResponse } from '@shiksha/api-contract';
import type { PostRequest, StaffPostsResponse } from '@shiksha/api-contract/staff';
import { STAFF_POSTS_CAP } from '@shiksha/api-contract/staff';
import type { AuditRepo, LearnerRepo, OrgRepo, PostRepo, PostRow, SwitchRepo } from '../ports.js';
import { withAudit } from './audit.js';
import { callerLearner } from './caller.js';
import { ApiFailure } from './failure.js';
import { effectiveSwitches } from './me.js';
import type { StaffCaller } from './staff.js';

export interface CommunityDeps {
  posts: PostRepo;
  audit: AuditRepo;
  org: OrgRepo;
  learners: LearnerRepo;
  switches: SwitchRepo;
}

type Audience = PostRequest['audience'];

/** A mentor reaches only their own cohorts; an admin any cohort and everyone. */
async function checkAudience(
  deps: CommunityDeps,
  staff: StaffCaller,
  audience: Audience,
): Promise<string | null> {
  if (audience.kind === 'all') {
    if (staff.role !== 'admin') throw new ApiFailure('FORBIDDEN');
    return null;
  }
  const { cohortId } = audience;
  if (staff.role !== 'admin') {
    if (!staff.cohortIds.includes(cohortId)) throw new ApiFailure('FORBIDDEN');
  } else if ((await deps.org.cohorts([cohortId])).length === 0) {
    throw new ApiFailure('INVALID_REQUEST');
  }
  return cohortId;
}

/** The author may change a post while it is in their scope; a mentor must still hold its cohort. */
const canEdit = (staff: StaffCaller, post: PostRow): boolean =>
  post.authorId === staff.staffId &&
  (staff.role === 'admin' || (post.cohortId !== null && staff.cohortIds.includes(post.cohortId)));

const canDelete = (staff: StaffCaller, post: PostRow): boolean =>
  staff.role === 'admin' || canEdit(staff, post);

const audit = (cohortId: string | null, postId: string): Record<string, string | null> => ({
  postId,
  audience: cohortId ? 'cohort' : 'all',
  cohortId,
});

/** Create a post, or edit one of your own. An unknown or someone else's post is `FORBIDDEN`. */
export async function savePost(
  deps: CommunityDeps,
  staff: StaffCaller,
  body: PostRequest,
  now: Date = new Date(),
): Promise<string> {
  const cohortId = await checkAudience(deps, staff, body.audience);
  const existing = body.id ? await deps.posts.get(body.id) : null;
  if (body.id && (!existing || !canEdit(staff, existing))) throw new ApiFailure('FORBIDDEN');
  const post = {
    ...(body.id ? { id: body.id } : {}),
    authorId: staff.staffId,
    cohortId,
    title: body.title,
    body: body.body,
    session: body.session,
  };
  const action = existing ? ('post_edited' as const) : ('post_created' as const);
  // The id of a new post exists only after saving, so the audit entry is written with it.
  const saved = await deps.posts.save(post, now);
  const record = { staff, action, learnerId: null, details: audit(cohortId, saved) };
  await withAudit(deps, record, () => Promise.resolve());
  return saved;
}

/** Delete a post: its author while in scope, or any admin. */
export async function deletePost(
  deps: CommunityDeps,
  staff: StaffCaller,
  input: { id: string },
): Promise<void> {
  const post = await deps.posts.get(input.id);
  if (!post || !canDelete(staff, post)) throw new ApiFailure('FORBIDDEN');
  const record = {
    staff,
    action: 'post_deleted' as const,
    learnerId: null,
    details: audit(post.cohortId, post.id),
  };
  await withAudit(deps, record, () => deps.posts.delete(post.id));
}

const toFeedPost = (row: PostRow): FeedResponse['posts'][number] => ({
  id: row.id,
  title: row.title,
  body: row.body,
  authorName: row.authorName,
  toCohort: row.cohortId !== null,
  createdAt: row.createdAt,
  editedAt: row.editedAt,
  session: row.session,
});

/** What the staff section lists: the posts in their scope, with who may change each. */
export async function listStaffPosts(
  deps: CommunityDeps,
  staff: StaffCaller,
): Promise<StaffPostsResponse> {
  const scope = {
    cohortIds: staff.role === 'admin' ? ('all' as const) : staff.cohortIds,
    authorId: staff.staffId,
  };
  const rows = await deps.posts.list(scope, STAFF_POSTS_CAP);
  return {
    posts: rows.map((row) => ({
      ...toFeedPost(row),
      cohortId: row.cohortId,
      canEdit: canEdit(staff, row),
      canDelete: canDelete(staff, row),
    })),
  };
}

/** A student's feed: posts to everyone and to their own cohort, newest first. */
export async function getFeed(deps: CommunityDeps, authUserId: string): Promise<FeedResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  if (!(await effectiveSwitches(deps.switches, learner.id)).community_feed) {
    throw new ApiFailure('FEATURE_OFF');
  }
  const cohortId = (await deps.org.cohortOfLearner(learner.id)) ?? null;
  return { posts: (await deps.posts.feed(cohortId, FEED_CAP)).map(toFeedPost) };
}

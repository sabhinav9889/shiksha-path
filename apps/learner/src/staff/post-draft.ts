import type { PostRequest, StaffMe, StaffPost } from '@shiksha/api-contract/staff';
import { fromLocalInput, toLocalInput } from './post-time.js';

const DEFAULT_MINUTES = 60;

/** The form's values: plain strings and numbers, as the inputs hold them. */
export interface PostDraft {
  title: string;
  body: string;
  /** `all` or a cohort id. */
  audience: string;
  session: boolean;
  startsAt: string;
  minutes: number;
  link: string;
}

/** An admin starts with everyone; a mentor with their first cohort. */
const firstAudience = (me: StaffMe | null): string =>
  me?.role === 'admin' ? 'all' : (me?.cohorts[0]?.id ?? '');

const sessionDraft = (post: StaffPost | null): Omit<PostDraft, 'title' | 'body' | 'audience'> => {
  const session = post?.session ?? null;
  return {
    session: session !== null,
    startsAt: session ? toLocalInput(session.startsAt) : '',
    minutes: session?.minutes ?? DEFAULT_MINUTES,
    link: session?.link ?? '',
  };
};

/** A blank form, or the form filled from the post being changed. */
export function draftOf(post: StaffPost | null, me: StaffMe | null): PostDraft {
  return {
    title: post?.title ?? '',
    body: post?.body ?? '',
    audience: post ? (post.cohortId ?? 'all') : firstAudience(me),
    ...sessionDraft(post),
  };
}

/** The request the server expects; the server checks every rule again. */
export function requestOf(draft: PostDraft, id: string | undefined): PostRequest {
  const audience =
    draft.audience === 'all'
      ? ({ kind: 'all' } as const)
      : ({ kind: 'cohort', cohortId: draft.audience } as const);
  const session = draft.session
    ? {
        startsAt: fromLocalInput(draft.startsAt),
        minutes: Number(draft.minutes),
        link: draft.link.trim() || null,
      }
    : null;
  return { ...(id ? { id } : {}), title: draft.title, body: draft.body, audience, session };
}

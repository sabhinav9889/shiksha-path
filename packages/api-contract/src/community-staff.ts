import { z } from 'zod';
import { feedPost } from './community.js';

const MAX_TITLE = 120;
const MAX_BODY = 4000;
const MAX_LINK = 500;
const MIN_MINUTES = 15;
const MAX_MINUTES = 480;

/** The newest posts the staff section lists. A fixed cap, not paging. */
export const STAFF_POSTS_CAP = 50;

/** Only `https:` links: a post is read by minors, so `http:`, `javascript:` and `data:` are out. */
export const sessionLink = z
  .string()
  .max(MAX_LINK)
  // The same rule as the database check, and no `user:password@` in a link a student may tap.
  .refine((link) => link.startsWith('https://') && !/^https:\/\/[^/]*@/.test(link))
  .pipe(z.url({ protocol: /^https$/ }));

export const postRequest = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(MAX_TITLE),
  body: z.string().trim().max(MAX_BODY),
  audience: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('all') }),
    z.strictObject({ kind: z.literal('cohort'), cohortId: z.uuid() }),
  ]),
  session: z
    .strictObject({
      startsAt: z.iso.datetime({ offset: true }),
      minutes: z.number().int().min(MIN_MINUTES).max(MAX_MINUTES),
      link: sessionLink.nullable(),
    })
    .nullable(),
});
export type PostRequest = z.infer<typeof postRequest>;

export const postDeleteRequest = z.strictObject({ id: z.uuid() });

export const staffPost = feedPost.extend({
  cohortId: z.uuid().nullable(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type StaffPost = z.infer<typeof staffPost>;

export const staffPostsResponse = z.object({ posts: z.array(staffPost).max(STAFF_POSTS_CAP) });
export type StaffPostsResponse = z.infer<typeof staffPostsResponse>;

import { z } from 'zod';

/** The newest posts a student sees. A fixed cap, not paging. */
export const FEED_CAP = 30;

/** A post as a student reads it. Plain text only: the app never renders it as HTML. */
export const feedPost = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  /** The author's name while they are active staff; otherwise null (the app shows the platform). */
  authorName: z.string().nullable(),
  toCohort: z.boolean(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  session: z
    .object({ startsAt: z.string(), minutes: z.number().int(), link: z.string().nullable() })
    .nullable(),
});
export type FeedPost = z.infer<typeof feedPost>;

// A response is `z.object` (extra fields dropped), so an old phone keeps working when a newer
// server adds a field.
export const feedResponse = z.object({ posts: z.array(feedPost).max(FEED_CAP) });
export type FeedResponse = z.infer<typeof feedResponse>;

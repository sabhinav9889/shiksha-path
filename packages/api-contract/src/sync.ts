import { z } from 'zod';

export const MAX_EVENTS_PER_PUSH = 100;
export const MAX_EVENTS_PER_PULL = 500;

/** Events are checked one by one on the server, so the batch only bounds their number here. */
export const pushRequest = z.strictObject({
  learnerId: z.uuid(),
  events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_PUSH),
});
export type PushRequest = z.infer<typeof pushRequest>;

export const pushResponse = z.strictObject({
  accepted: z.array(z.uuid()),
  /** Event ids, or `#<index>` for an event with no usable id. */
  rejected: z.array(z.string()),
});
export type PushResponse = z.infer<typeof pushResponse>;

export const pullQuery = z.strictObject({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_EVENTS_PER_PULL).default(MAX_EVENTS_PER_PULL),
});
export type PullQuery = z.infer<typeof pullQuery>;

export const pullResponse = z.strictObject({
  events: z.array(z.unknown()),
  /** The cursor for the next page, or `null` when there is nothing more. */
  next: z.number().int().nullable(),
  /** Where this page ended: pass it as `after` next time to get only newer events. */
  cursor: z.number().int().min(0),
});
export type PullResponse = z.infer<typeof pullResponse>;

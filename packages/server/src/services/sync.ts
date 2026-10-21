import type { PullQuery, PullResponse, PushRequest, PushResponse } from '@shiksha/api-contract';
import { learnerEventSchema, type LearnerEvent } from '@shiksha/learner-core';
import type { EventRepo, LearnerRepo, RateLimiter } from '../ports.js';
import { enforce } from './limits.js';
import { callerLearner } from './caller.js';
import { ApiFailure } from './failure.js';

/** How an event with no usable id is named in `rejected`: its position in the batch. */
function labelOf(raw: unknown, index: number): string {
  const id = typeof raw === 'object' && raw !== null ? (raw as { id?: unknown }).id : undefined;
  return typeof id === 'string' && id.length > 0 ? id : `#${index}`;
}

/** Valid events of this learner (first copy of each id) and the labels of everything else. */
function sortEvents(
  learnerId: string,
  raw: unknown[],
): { valid: LearnerEvent[]; rejected: string[] } {
  const valid = new Map<string, LearnerEvent>();
  const rejected: string[] = [];
  raw.forEach((candidate, index) => {
    const parsed = learnerEventSchema.safeParse(candidate);
    if (!parsed.success || parsed.data.learnerId !== learnerId) {
      rejected.push(labelOf(candidate, index));
      return;
    }
    if (!valid.has(parsed.data.id)) valid.set(parsed.data.id, parsed.data);
  });
  return { valid: [...valid.values()], rejected };
}

/**
 * Store a batch from the phone. Idempotent: an event already stored for this learner is accepted
 * again (a retry); one whose id belongs to someone else is rejected.
 */
export async function pushEvents(
  deps: { learners: LearnerRepo; events: EventRepo; limiter: RateLimiter },
  authUserId: string,
  request: PushRequest,
): Promise<PushResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  await enforce(deps.limiter, 'push', `push:${learner.id}`);
  if (request.learnerId !== learner.id) throw new ApiFailure('FORBIDDEN');
  const { valid, rejected } = sortEvents(learner.id, request.events);
  if (valid.length === 0) return { accepted: [], rejected };
  const { ownedByOthers } = await deps.events.insertMany(learner.id, valid);
  const taken = new Set(ownedByOthers);
  return {
    accepted: valid.filter((e) => !taken.has(e.id)).map((e) => e.id),
    rejected: [...rejected, ...ownedByOthers],
  };
}

/** The server's ordering number is a cursor, not part of the event the phone made. */
function withoutSeq(row: LearnerEvent & { seq: number }): LearnerEvent {
  const event: Partial<typeof row> = { ...row };
  delete event.seq;
  return event as LearnerEvent;
}

/** The learner's events after the cursor, oldest first, for restore and other phones. */
export async function pullEvents(
  deps: { learners: LearnerRepo; events: EventRepo; limiter: RateLimiter },
  authUserId: string,
  query: PullQuery,
): Promise<PullResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  await enforce(deps.limiter, 'pull', `pull:${learner.id}`);
  const { events } = await deps.events.page(learner.id, query.after, query.limit);
  const last = events.at(-1);
  return {
    events: events.map(withoutSeq),
    next: events.length === query.limit && last ? last.seq : null,
    cursor: last?.seq ?? query.after,
  };
}

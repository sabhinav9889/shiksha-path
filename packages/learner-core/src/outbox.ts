import type { LearnerEvent } from './events.js';
import type { Clock } from './ports.js';

export const OUTBOX_BATCH_SIZE = 50;

const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 900_000;
const ALL_PENDING = Number.MAX_SAFE_INTEGER;

export interface EventStore {
  /** Idempotent on the event id. */
  append(event: LearnerEvent): Promise<void>;
  /** In append order. */
  all(learnerId: string): Promise<LearnerEvent[]>;
  /** In append order, without events the server has acknowledged. */
  pending(learnerId: string, limit: number): Promise<LearnerEvent[]>;
  markSent(ids: string[]): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

export interface SyncTransport {
  /** `rejected` ids are refused for good (they stay in the local log but are never re-sent). */
  push(
    learnerId: string,
    events: LearnerEvent[],
  ): Promise<{ accepted: string[]; rejected?: string[] }>;
}

export interface FlushResult {
  ok: boolean;
  sent: number;
  remaining: number;
  nextAttemptInMs: number | null;
}

interface FlushDeps {
  store: EventStore;
  transport: SyncTransport;
  clock: Clock;
}

/** 0 after no failures; then 5 s, 10 s, 20 s … up to 15 minutes. */
export function retryDelayMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);
}

const failuresKey = (learnerId: string): string => `failures:${learnerId}`;

async function failureCount(store: EventStore, learnerId: string): Promise<number> {
  return Number((await store.getMeta(failuresKey(learnerId))) ?? 0) || 0;
}

/** Push batches until nothing is pending; throws on failure. `progress.sent` counts as it goes. */
async function drain(
  learnerId: string,
  deps: FlushDeps,
  progress: { sent: number },
): Promise<void> {
  for (;;) {
    const batch = await deps.store.pending(learnerId, OUTBOX_BATCH_SIZE);
    if (batch.length === 0) return;
    const { accepted, rejected = [] } = await deps.transport.push(learnerId, batch);
    const batchIds = new Set(batch.map((e) => e.id));
    const confirmed = accepted.filter((id) => batchIds.has(id));
    const refused = rejected.filter((id) => batchIds.has(id));
    if (confirmed.length + refused.length === 0) throw new Error('the server accepted nothing');
    await deps.store.markSent([...confirmed, ...refused]);
    progress.sent += confirmed.length;
  }
}

async function run(learnerId: string, deps: FlushDeps): Promise<FlushResult> {
  const { store, clock } = deps;
  const progress = { sent: 0 };
  try {
    await drain(learnerId, deps, progress);
  } catch {
    const failures = (await failureCount(store, learnerId)) + 1;
    await store.setMeta(failuresKey(learnerId), String(failures));
    const remaining = (await store.pending(learnerId, ALL_PENDING)).length;
    return { ok: false, sent: progress.sent, remaining, nextAttemptInMs: retryDelayMs(failures) };
  }
  await store.setMeta(`lastSyncedAt:${learnerId}`, clock.now().toISOString());
  await store.setMeta(failuresKey(learnerId), '0');
  return { ok: true, sent: progress.sent, remaining: 0, nextAttemptInMs: null };
}

const running = new WeakMap<EventStore, Map<string, Promise<FlushResult>>>();

/** Reported when even recording the failure failed (the store itself is broken). */
const GIVE_UP: FlushResult = {
  ok: false,
  sent: 0,
  remaining: 0,
  nextAttemptInMs: RETRY_BASE_MS,
};

/**
 * Send what the server has not acknowledged yet, in batches. Never throws: a failure is a result
 * with a retry delay, because learning never waits for sync. Calls for the same learner on the
 * same store share one run.
 */
export function flushOutbox(learnerId: string, deps: FlushDeps): Promise<FlushResult> {
  const perStore = running.get(deps.store) ?? new Map<string, Promise<FlushResult>>();
  running.set(deps.store, perStore);
  const existing = perStore.get(learnerId);
  if (existing) return existing;
  const started = run(learnerId, deps)
    .catch(() => GIVE_UP)
    .finally(() => perStore.delete(learnerId));
  perStore.set(learnerId, started);
  return started;
}

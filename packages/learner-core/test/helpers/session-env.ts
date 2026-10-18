import type { Answer } from '../../src/scoring.js';
import type { QuizRun } from '../../src/quiz.js';
import { LearnerSession } from '../../src/session.js';
import { MemoryEventStore, fixedClock, sequentialIds } from '../../src/testing/index.js';
import { makeEnv, type Env } from './env.js';

export const EN = 'english-foundation-1';
export const APT = 'aptitude-1';
export const LEARNER = 'learner-1';

export interface SessionEnv extends Env {
  events: MemoryEventStore;
  clock: ReturnType<typeof fixedClock>;
  ids: ReturnType<typeof sequentialIds>;
  open(learnerId?: string, events?: MemoryEventStore): Promise<LearnerSession>;
}

/** A synced phone (all content installed) plus a way to open a session on it. */
export async function makeSessionEnv(
  syncOptions: Parameters<Env['sync']>[0] = {},
): Promise<SessionEnv> {
  const env = await makeEnv();
  await env.sync(syncOptions);
  const events = new MemoryEventStore();
  const clock = fixedClock('2026-10-18T10:00:00Z');
  const ids = sequentialIds();
  return {
    ...env,
    events,
    clock,
    ids,
    open: (learnerId = LEARNER, store = events) =>
      LearnerSession.open({ learnerId, storage: env.storage, events: store, clock, ids }),
  };
}

const RIGHT_ORDER = ['I', 'am', 'Priya'];
const WRONG_ORDER = ['am', 'I', 'Priya'];

/** The right (or deliberately wrong) answer for each item type the fixture uses. */
export function answerFor(run: QuizRun, right: boolean): Answer {
  const item = run.entries[run.answered.length]?.item;
  if (item?.type === 'word_order')
    return { kind: 'order', words: right ? RIGHT_ORDER : WRONG_ORDER };
  if (item?.type === 'listen_choose') return { kind: 'choice', optionId: right ? 'a' : 'b' };
  throw new Error(`no answer helper for ${item?.type}`);
}

/** Answer every item of a run; `wrongAt` lists the positions answered wrongly. */
export async function playRun(
  session: LearnerSession,
  start: QuizRun,
  wrongAt: readonly number[] = [],
): Promise<QuizRun> {
  let run = start;
  while (run.answered.length < run.entries.length) {
    const right = !wrongAt.includes(run.answered.length);
    run = (await session.answer(run, answerFor(run, right))).run;
  }
  return run;
}

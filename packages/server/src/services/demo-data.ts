import {
  addDays,
  createEvent,
  cryptoIds,
  istDay,
  type Clock,
  type LearnerEvent,
} from '@shiksha/learner-core';
import type { EventRepo, OrgRepo, SummaryRepo } from '../ports.js';
import { issueCode, type CodeDeps } from './codes.js';
import { ApiFailure } from './failure.js';
import { deleteLearner, type LearnerDataDeps } from './learner-data.js';
import { summarise } from './summary.js';

/** A cohort of made-up students for showing the mentor screens. Never real people. */
export const DEMO_LAB = 'डेमो लैब';
export const DEMO_COHORT = 'डेमो समूह (नकली छात्र)';

type Kind = 'active' | 'inactive' | 'stuck' | 'low' | 'fresh';

/** First names only, from a fixed list: removal deletes by this list, so a real student is safe. */
const PLAN: { name: string; kind: Kind; lastActive: number }[] = [
  { name: 'आरव', kind: 'active', lastActive: 0 },
  { name: 'सिया', kind: 'active', lastActive: 0 },
  { name: 'कबीर', kind: 'active', lastActive: 0 },
  { name: 'मीरा', kind: 'active', lastActive: 1 },
  { name: 'रोहन', kind: 'inactive', lastActive: 5 },
  { name: 'नेहा', kind: 'inactive', lastActive: 7 },
  { name: 'विकास', kind: 'inactive', lastActive: 10 },
  { name: 'पूजा', kind: 'stuck', lastActive: 0 },
  { name: 'अमन', kind: 'stuck', lastActive: 1 },
  { name: 'काजल', kind: 'low', lastActive: 1 },
  { name: 'सुमित', kind: 'low', lastActive: 1 },
  { name: 'तान्या', kind: 'fresh', lastActive: 0 },
];
export const DEMO_NAMES: readonly string[] = PLAN.map((p) => p.name);

export interface DemoDeps extends LearnerDataDeps {
  codes: CodeDeps;
  org: OrgRepo;
  events: EventRepo;
  summaries: SummaryRepo;
}

export interface DemoOptions {
  /** Lessons that exist in the published content, so the screens show real ids. */
  lessonIds: string[];
  now: Date;
}

const ACTIVE_STREAK_DAYS = 5;
const ANSWERS_PER_LESSON = 4;
const STUCK_DAYS = 3;
const LOW_RUN = 3;
const SCORED = 5;

/** Writes one demo student's events on days counted back from `today` (10:00 India time). */
function writer(learnerId: string, today: string) {
  const out: LearnerEvent[] = [];
  const at = (daysAgo: number) => ({
    clock: { now: () => new Date(`${addDays(today, -daysAgo)}T04:30:00Z`) } satisfies Clock,
    ids: cryptoIds,
  });
  const started = (day: number, lessonId: string): void => {
    out.push(createEvent(at(day), learnerId, 'lesson_started', { lessonId, moduleVersion: '1' }));
  };
  const answer = (day: number, lessonId: string, right: boolean): void => {
    const source = { kind: 'lesson' as const, lessonId };
    const outcome = right ? ('correct' as const) : ('wrong' as const);
    out.push(
      createEvent(at(day), learnerId, 'item_answered', {
        source,
        itemId: `q${out.length}`,
        outcome,
      }),
    );
  };
  const finish = (day: number, lessonId: string, correct: number): void => {
    started(day, lessonId);
    for (let n = 0; n < ANSWERS_PER_LESSON; n += 1) answer(day, lessonId, n < correct);
    const done = { lessonId, correct, scored: SCORED };
    out.push(createEvent(at(day), learnerId, 'lesson_completed', done));
  };
  return { out, started, answer, finish };
}

type Writer = ReturnType<typeof writer>;
type Plan = (typeof PLAN)[number];

const SHAPES: Record<Kind, (w: Writer, plan: Plan, lesson: (n: number) => string) => void> = {
  active: (w, plan, lesson) => {
    for (let n = 0; n < ACTIVE_STREAK_DAYS; n += 1) {
      w.finish(plan.lastActive + ACTIVE_STREAK_DAYS - 1 - n, lesson(n), ANSWERS_PER_LESSON);
    }
  },
  inactive: (w, plan, lesson) => {
    for (let n = 0; n < STUCK_DAYS; n += 1) {
      w.finish(plan.lastActive + n, lesson(n), ANSWERS_PER_LESSON);
    }
  },
  stuck: (w, plan, lesson) => {
    for (let n = 0; n < STUCK_DAYS; n += 1) {
      const day = plan.lastActive + STUCK_DAYS - 1 - n;
      w.started(day, lesson(0)); // the same lesson on three days, never finished
      w.answer(day, lesson(0), false);
      w.answer(day, lesson(0), n === STUCK_DAYS - 1);
    }
  },
  low: (w, plan, lesson) => {
    for (let n = 0; n < LOW_RUN; n += 1) {
      w.finish(plan.lastActive + LOW_RUN - 1 - n, lesson(n), 1 + (n % 2));
    }
  },
  fresh: () => undefined,
};

function history(learnerId: string, plan: Plan, lessons: string[], today: string): LearnerEvent[] {
  const w = writer(learnerId, today);
  SHAPES[plan.kind](w, plan, (n) => lessons[n % lessons.length] ?? 'ef1-01');
  return w.out;
}

/** Create the demo lab, cohort and students. Refuses when the demo cohort already has students. */
export async function seedDemo(
  deps: DemoDeps,
  options: DemoOptions,
): Promise<{ cohortId: string; students: number }> {
  const today = istDay(options.now);
  const lab =
    (await deps.org.labs()).find((l) => l.name === DEMO_LAB)?.id ??
    (await deps.org.saveLab({ name: DEMO_LAB }));
  const cohortId =
    (await deps.org.cohorts('all')).find((c) => c.name === DEMO_COHORT)?.id ??
    (await deps.org.saveCohort({ name: DEMO_COHORT, labId: lab }));
  if ((await deps.org.students([cohortId])).length > 0) throw new ApiFailure('INVALID_REQUEST');
  for (const plan of PLAN) {
    const { learnerId } = await issueCode(deps.codes, { name: plan.name });
    await deps.org.setLearnerCohort(learnerId, cohortId);
    const events = history(learnerId, plan, options.lessonIds, today);
    if (events.length > 0) await deps.events.insertMany(learnerId, events);
    await deps.summaries.refresh(learnerId, (log) => summarise(log, today));
  }
  return { cohortId, students: PLAN.length };
}

/** Delete the demo students (only those with a demo name in the demo cohort); returns how many. */
export async function removeDemo(deps: DemoDeps): Promise<number> {
  const cohort = (await deps.org.cohorts('all')).find((c) => c.name === DEMO_COHORT);
  if (!cohort) return 0;
  const fake = (await deps.org.students([cohort.id])).filter((s) => DEMO_NAMES.includes(s.name));
  for (const student of fake) await deleteLearner(deps, student.id);
  return fake.length;
}

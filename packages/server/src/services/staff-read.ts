import type { StaffCohorts, StudentDetail } from '@shiksha/api-contract/staff';
import { istDay, parseEvents, type LearnerEvent } from '@shiksha/learner-core';
import type {
  AttendanceRepo,
  CodeRepo,
  EventRepo,
  OrgRepo,
  RecordingRepo,
  StudentRow,
  SummaryRepo,
  SwitchRepo,
} from '../ports.js';
import { effectiveSwitches } from './me.js';
import { attendanceFrom } from './mentor-actions.js';
import { inScope, type StaffCaller } from './staff.js';
import { needsAttention, type Attention, type Summary } from './summary.js';

export interface StaffReadDeps {
  attendance: AttendanceRepo;
  org: OrgRepo;
  summaries: SummaryRepo;
  events: EventRepo;
  recordings: RecordingRepo;
  switches: SwitchRepo;
  codes: CodeRepo;
}

const RECENT = 50;
const WEAK = 5;
const ALL = Number.MAX_SAFE_INTEGER;

function studentLine(row: StudentRow, summary: Summary | undefined, today: string) {
  return {
    id: row.id,
    name: row.name,
    deactivated: row.deactivated,
    summary: summary ?? null,
    attention: summary ? needsAttention(summary, row.linkedOn, today) : ([] as Attention[]),
    lastSyncedAt: row.lastSyncedAt,
  };
}

/** The caller's cohorts (every cohort for an admin), students needing attention first. */
export async function listCohorts(deps: StaffReadDeps, staff: StaffCaller): Promise<StaffCohorts> {
  const scope = staff.role === 'admin' ? 'all' : staff.cohortIds;
  const [cohorts, students] = await Promise.all([
    deps.org.cohorts(scope),
    deps.org.students(scope),
  ]);
  const summaries = await deps.summaries.forLearners(students.map((s) => s.id));
  const today = istDay(new Date());
  return {
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      students: students
        .filter((s) => s.cohortId === cohort.id)
        .map((s) => studentLine(s, summaries.get(s.id), today))
        .sort((x, y) => y.attention.length - x.attention.length || x.name.localeCompare(y.name)),
    })),
  };
}

/** Lessons with the most wrong answers, each event counted once. */
function weakLessons(events: LearnerEvent[]): { lessonId: string; wrong: number }[] {
  const seen = new Set<string>();
  const wrong = new Map<string, number>();
  for (const e of events) {
    if (seen.has(e.id) || e.type !== 'item_answered') continue;
    seen.add(e.id);
    if (e.data.outcome !== 'wrong' || e.data.source.kind !== 'lesson') continue;
    const lessonId = e.data.source.lessonId;
    wrong.set(lessonId, (wrong.get(lessonId) ?? 0) + 1);
  }
  return [...wrong]
    .map(([lessonId, n]) => ({ lessonId, wrong: n }))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, WEAK);
}

/** Everything a mentor sees about one student in scope (spec §8 student detail). */
export async function studentDetail(
  deps: StaffReadDeps,
  staff: StaffCaller,
  learnerId: string,
): Promise<StudentDetail> {
  await inScope(deps, staff, learnerId);
  const row = await deps.org.student(learnerId);
  if (!row) throw new Error('a learner in scope has no row');
  const [summaries, page, recordings, switches, code] = await Promise.all([
    deps.summaries.forLearners([learnerId]),
    deps.events.page(learnerId, 0, ALL),
    deps.recordings.listByLearner(learnerId),
    effectiveSwitches(deps.switches, learnerId),
    deps.codes.forLearner(learnerId),
  ]);
  const events = parseEvents(page.events).events;
  const line = studentLine(row, summaries.get(learnerId), istDay(new Date()));
  return {
    student: { id: row.id, name: row.name, cohortId: row.cohortId, deactivated: row.deactivated },
    summary: line.summary,
    attention: line.attention,
    recent: [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT),
    weakLessons: weakLessons(events),
    recordings: recordings.map((r) => ({
      id: r.id,
      lessonId: r.lessonId,
      itemId: r.itemId,
      durationMs: r.durationMs,
      recordedAt: r.recordedAt,
      status: r.status,
      reviewedAt: r.reviewedAt,
      comment: r.comment,
    })),
    attendance: await deps.attendance.forLearner(learnerId, attendanceFrom()),
    switches,
    hasCode: code !== null,
  };
}

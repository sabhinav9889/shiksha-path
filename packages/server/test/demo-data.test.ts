import { describe, expect, test } from 'vitest';
import {
  DEMO_COHORT,
  DEMO_NAMES,
  removeDemo,
  seedDemo,
  type DemoDeps,
} from '../src/services/demo-data.js';
import { listCohorts } from '../src/services/staff-read.js';
import { codeOf } from '../src/testing/staff-world.js';
import { issueCode } from '../src/services/codes.js';
import { makeMemoryCodeFixture } from '../src/testing/memory-auth.js';

const LESSONS = ['ef1-01-greetings', 'apt-01-patterns'];
const admin = { staffId: crypto.randomUUID(), role: 'admin' as const, cohortIds: [] };

function setup(): DemoDeps {
  const { deps } = makeMemoryCodeFixture();
  return { ...deps, codes: deps } as unknown as DemoDeps;
}

const demoStudents = async (deps: DemoDeps) => {
  const cohorts = (await listCohorts(deps as never, admin)).cohorts;
  return cohorts.find((c) => c.name === DEMO_COHORT)?.students ?? [];
};

describe('the demo cohort', () => {
  test('is made of fake students with varied progress and every kind of attention flag', async () => {
    const deps = setup();
    const out = await seedDemo(deps, { lessonIds: LESSONS, now: new Date('2026-10-27T10:00:00Z') });
    expect(out.students).toBe(DEMO_NAMES.length);
    const students = await demoStudents(deps);
    expect(students.map((s) => s.name).sort()).toEqual([...DEMO_NAMES].sort());
    const flags = students.flatMap((s) => s.attention);
    expect(flags).toContain('inactive');
    expect(flags).toContain('stuck');
    expect(flags).toContain('low_scores');
    const quiet = students.filter((s) => s.attention.length === 0);
    expect(quiet.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...students.map((s) => s.summary?.lessonsDone ?? 0))).toBeGreaterThanOrEqual(2);
    // the ones needing attention come first, as the cohort page shows them
    const firstQuiet = students.findIndex((s) => s.attention.length === 0);
    expect(students.slice(firstQuiet).every((s) => s.attention.length === 0)).toBe(true);
  });

  test('seeding twice is refused, so nothing is duplicated', async () => {
    const deps = setup();
    const opts = { lessonIds: LESSONS, now: new Date('2026-10-27T10:00:00Z') };
    await seedDemo(deps, opts);
    expect(await codeOf(seedDemo(deps, opts))).toBe('INVALID_REQUEST');
    expect(await demoStudents(deps)).toHaveLength(DEMO_NAMES.length);
  });

  test('removing deletes only the fake students, even a real one put in the same cohort stays', async () => {
    const deps = setup();
    await seedDemo(deps, { lessonIds: LESSONS, now: new Date('2026-10-27T10:00:00Z') });
    const cohort = (await deps.org.cohorts('all')).find((c) => c.name === DEMO_COHORT);
    const real = await issueCode(deps.codes, { name: 'असली छात्र' });
    await deps.org.setLearnerCohort(real.learnerId, cohort?.id ?? null);
    expect(await removeDemo(deps)).toBe(DEMO_NAMES.length);
    const left = await demoStudents(deps);
    expect(left.map((s) => s.name)).toEqual(['असली छात्र']);
    expect(await removeDemo(deps)).toBe(0);
  });
});

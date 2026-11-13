import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import * as admin from '../services/admin.js';
import { listAudit } from '../services/audit.js';
import type { ServiceFixture } from './service-contract.js';
import { codeOf, staffWorld } from './staff-world.js';

/** Renaming and moving labs and cohorts (admin only), against any set of repositories. */
export function describeGroupEditContract(name: string, make: () => Promise<ServiceFixture>): void {
  describe(`editing labs and cohorts over ${name}`, () => {
    const w = staffWorld(make);
    const { staffMember } = w;
    let f: ServiceFixture;
    let cohortA: string;
    let learnerA: string;
    beforeEach(() => {
      ({ f, cohortA, learnerA } = w);
    });

    test('an admin renames a lab and a cohort; ids, students and mentors stay', async () => {
      const boss = await staffMember('admin', []);
      const mentor = await staffMember('mentor', [cohortA]);
      const [cohort] = await f.org.cohorts([cohortA]);
      const labId = cohort?.labId ?? '';
      expect(await admin.saveLab(f, boss, { id: labId, name: 'नई लैब' })).toBe(labId);
      expect(await admin.saveCohort(f, boss, { id: cohortA, name: 'नया समूह', labId })).toBe(
        cohortA,
      );
      expect((await f.org.labs()).find((l) => l.id === labId)?.name).toBe('नई लैब');
      expect((await f.org.cohorts([cohortA]))[0]).toEqual({ id: cohortA, name: 'नया समूह', labId });
      expect(await f.org.cohortOfLearner(learnerA)).toBe(cohortA);
      expect(
        (await admin.getSetup(f, boss)).staff.find((s) => s.id === mentor.staffId)?.cohortIds,
      ).toEqual([cohortA]);
    });

    test('a cohort moves to another lab, or out of any lab, with its students', async () => {
      const boss = await staffMember('admin', []);
      const other = await f.org.saveLab({ name: 'Other' });
      await admin.saveCohort(f, boss, { id: cohortA, name: 'A', labId: other });
      expect((await f.org.cohorts([cohortA]))[0]?.labId).toBe(other);
      await admin.saveCohort(f, boss, { id: cohortA, name: 'A', labId: null });
      expect((await f.org.cohorts([cohortA]))[0]?.labId).toBeNull();
      expect(await f.org.cohortOfLearner(learnerA)).toBe(cohortA);
    });

    test('an edit is audited with the new name; a create still makes a new row', async () => {
      const boss = await staffMember('admin', []);
      await admin.saveCohort(f, boss, { id: cohortA, name: 'Renamed', labId: null });
      const entry = (await listAudit(f, boss, null, 100)).entries.find(
        (e) => e.action === 'cohort_saved' && e.details['id'] === cohortA,
      );
      expect(entry?.details).toMatchObject({ id: cohortA, name: 'Renamed', labId: null });
      const before = (await f.org.cohorts('all')).length;
      const made = await admin.saveCohort(f, boss, { name: 'Brand new', labId: null });
      expect(made).not.toBe(cohortA);
      expect((await f.org.cohorts('all')).length).toBe(before + 1);
    });

    test('editing something that is not there is refused, creates nothing and is not audited', async () => {
      const boss = await staffMember('admin', []);
      const nothing = randomUUID();
      const labs = (await f.org.labs()).length;
      const cohorts = (await f.org.cohorts('all')).length;
      expect(await codeOf(admin.saveLab(f, boss, { id: nothing, name: 'Ghost' }))).toBe(
        'INVALID_REQUEST',
      );
      expect(
        await codeOf(admin.saveCohort(f, boss, { id: nothing, name: 'Ghost', labId: null })),
      ).toBe('INVALID_REQUEST');
      expect((await f.org.labs()).length).toBe(labs);
      expect((await f.org.cohorts('all')).length).toBe(cohorts);
      const log = await listAudit(f, boss, null, 100);
      expect(log.entries.some((e) => e.details['id'] === nothing)).toBe(false);
    });

    test('a cohort cannot be put in a lab that does not exist, new or edited', async () => {
      const boss = await staffMember('admin', []);
      const ghostLab = randomUUID();
      expect(await codeOf(admin.saveCohort(f, boss, { name: 'X', labId: ghostLab }))).toBe(
        'INVALID_REQUEST',
      );
      expect(
        await codeOf(admin.saveCohort(f, boss, { id: cohortA, name: 'A', labId: ghostLab })),
      ).toBe('INVALID_REQUEST');
      expect((await f.org.cohorts([cohortA]))[0]?.labId).not.toBe(ghostLab);
    });

    test('a mentor cannot rename or move anything', async () => {
      const mentor = await staffMember('mentor', [cohortA]);
      expect(
        await codeOf(admin.saveCohort(f, mentor, { id: cohortA, name: 'Hijack', labId: null })),
      ).toBe('FORBIDDEN');
      expect((await f.org.cohorts([cohortA]))[0]?.name).toBe('A');
    });
  });
}

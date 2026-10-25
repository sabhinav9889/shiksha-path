// `npm run admin -- seed-demo`: made-up students for showing the mentor screens.
import { loadContent } from '../../packages/content/src/load.js';
import {
  DEMO_COHORT,
  DEMO_NAMES,
  removeDemo,
  seedDemo,
} from '../../packages/server/src/services/demo-data.js';
import type { AdminDeps, AdminIo } from './commands.js';

/** Lesson ids from the content folder, so the demo shows ids that exist in the published packs. */
async function lessonIdsOnDisk(): Promise<string[]> {
  const { content } = await loadContent('content');
  const ids = content.modules.flatMap((m) => m.lessons.map((l) => l.meta.id));
  return ids.length > 0 ? ids : ['ef1-01'];
}

export async function runSeedDemo(
  deps: AdminDeps,
  options: { remove: boolean; dryRun: boolean },
  io: AdminIo,
): Promise<number> {
  if (options.dryRun) {
    io.out(`would make ${DEMO_NAMES.length} demo students in "${DEMO_COHORT}"`);
    return 0;
  }
  const demo = {
    ...deps.data,
    codes: deps.codes,
    org: deps.org,
    events: deps.events,
    summaries: deps.summaries,
  };
  if (options.remove) {
    io.out(`removed ${await removeDemo(demo)} demo students`);
    return 0;
  }
  const made = await seedDemo(demo, { lessonIds: await lessonIdsOnDisk(), now: new Date() });
  io.out(`made ${made.students} demo students in "${DEMO_COHORT}"`);
  return 0;
}

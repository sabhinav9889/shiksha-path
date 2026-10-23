import type { EventRepo, SummaryRepo } from '../ports.js';
import type { Summary } from '../services/summary.js';

const ALL = Number.MAX_SAFE_INTEGER;

export function memorySummaries(events: EventRepo): SummaryRepo {
  const rows = new Map<string, Summary>();
  let chain: Promise<unknown> = Promise.resolve();
  return {
    refresh(learnerId, derive) {
      // One at a time, like the per-learner lock in Postgres.
      const run = chain.then(async () => {
        const { events: log } = await events.page(learnerId, 0, ALL);
        const summary = derive(log);
        rows.set(learnerId, summary);
        return summary;
      });
      chain = run.catch(() => undefined);
      return run;
    },
    forLearners: (ids) =>
      Promise.resolve(
        new Map(
          ids.flatMap((id) => {
            const summary = rows.get(id);
            return summary ? [[id, structuredClone(summary)] as const] : [];
          }),
        ),
      ),
  };
}

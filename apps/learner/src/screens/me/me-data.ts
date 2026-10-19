import type { Localized } from '@shiksha/content/schema';
import {
  deriveProgress,
  parseEvents,
  type LanguagePreference,
  type LearnerSession,
  type StorageEstimator,
} from '@shiksha/learner-core';
import type { Runtime } from '../../runtime/runtime.js';
import { stateOf, type ModuleState } from '../lessons/lessons-data.js';

export interface MeData {
  language: LanguagePreference;
  sync: { lastSyncedAt: string | null; pending: number };
  storage: { used: number; quota: number | null };
  modules: { id: string; title: Localized; bytes: number; state: ModuleState }[];
  recordings: { count: number; bytes: number };
}

async function languageOf(
  runtime: Runtime,
  learnerId: string,
  session: LearnerSession | null,
): Promise<LanguagePreference> {
  if (session) return session.progress.language;
  return deriveProgress(parseEvents(await runtime.events.all(learnerId)).events).language;
}

/** What the "me" screen shows, gathered once. */
export async function loadMe(
  runtime: Runtime,
  learnerId: string,
  session: LearnerSession | null,
  estimator: StorageEstimator,
): Promise<MeData> {
  const manifest = await runtime.storage.getManifest();
  const modules: MeData['modules'] = [];
  for (const entry of manifest?.modules ?? []) {
    const state = manifest ? await stateOf(runtime, entry.id, manifest) : 'missing';
    modules.push({
      id: entry.id,
      title: entry.title,
      bytes: entry.bytes + entry.audio_bytes,
      state,
    });
  }
  const onPhone = modules.filter((m) => m.state === 'ready' || m.state === 'playable');
  const estimate = await estimator.estimate();
  return {
    language: await languageOf(runtime, learnerId, session),
    sync: await runtime.syncStatus(learnerId),
    // The browser's figure when it gives one, otherwise what our lesson packs take.
    storage: {
      used: estimate?.usage ?? onPhone.reduce((n, m) => n + m.bytes, 0),
      quota: estimate?.quota ?? null,
    },
    modules,
    recordings: await runtime.recordings.summary(learnerId),
  };
}

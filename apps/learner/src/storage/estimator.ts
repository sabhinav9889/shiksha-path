import type { StorageEstimator } from '@shiksha/learner-core';

type EstimateApi = Pick<StorageManager, 'estimate'> | undefined;

/** The browser's storage estimate, or `null` when it cannot tell (the core then proceeds). */
export function browserStorageEstimator(
  api: EstimateApi = typeof navigator === 'undefined' ? undefined : navigator.storage,
): StorageEstimator {
  return {
    async estimate() {
      try {
        const estimate = await api?.estimate();
        if (typeof estimate?.quota !== 'number' || typeof estimate.usage !== 'number') return null;
        return { quota: estimate.quota, usage: estimate.usage };
      } catch {
        return null;
      }
    },
  };
}

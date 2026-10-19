import type { SyncTransport } from '@shiksha/learner-core';

/** There is no server until Plan 3: every push fails, so events wait safely on the phone. */
export const noServerTransport: SyncTransport = {
  push: () => Promise.reject(new Error('no server yet')),
};

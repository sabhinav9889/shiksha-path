import type { SyncTransport } from '@shiksha/learner-core';
import type { ApiClient } from '../api/api-client.js';

/**
 * The core outbox's transport over /v1. Any failure rejects, so the events stay pending and the
 * outbox backs off; nothing is lost and learning is never blocked.
 */
export function httpTransport(client: ApiClient): SyncTransport {
  return {
    async push(learnerId, events) {
      const result = await client.push({ learnerId, events });
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },
  };
}

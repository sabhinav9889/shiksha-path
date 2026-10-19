import 'fake-indexeddb/auto';
import { createProfile, type Profile, type StorageEstimator } from '@shiksha/learner-core';
import {
  makeContentFixture,
  type ContentFixture,
} from '@shiksha/learner-core/test-helpers/content-fixture';
import { serveBuild, type ServedBuild } from '@shiksha/learner-core/test-helpers/serve-build';
import { createRuntime, type Runtime } from '../../src/runtime/runtime.js';

let counter = 0;

export interface TestEnv {
  runtime: Runtime;
  fixture: ContentFixture;
  server: ServedBuild;
  addProfile(name: string, pin?: string): Promise<Profile>;
}

/** Adapts the core's range-capable test server to the `fetch` signature the app uses. */
function serverFetch(server: ServedBuild): typeof fetch {
  return async (url, init) => {
    const match = new Headers(init?.headers).get('Range')?.match(/bytes=(\d+)-(\d+)/);
    const range = match ? { from: Number(match[1]), to: Number(match[2]) } : undefined;
    const result = await server.fetcher.get(String(url), range);
    return new Response(new Uint8Array(result.bytes), { status: result.status });
  };
}

/** A fresh database, the fixture lesson packs served locally, and (optionally) installed. */
export async function makeEnv(
  opts: { install?: boolean; estimator?: StorageEstimator } = {},
): Promise<TestEnv> {
  const fixture = await makeContentFixture();
  const server = serveBuild(fixture.outDir);
  const runtime = createRuntime({
    dbName: `app-test-${counter++}`,
    contentBaseUrl: server.baseUrl,
    fetchFn: serverFetch(server),
    ...(opts.estimator ? { estimator: opts.estimator } : {}),
  });
  if (opts.install ?? true) await runtime.content.sync();
  const addProfile = (name: string, pin = '1234'): Promise<Profile> =>
    createProfile(
      { name, pin },
      { store: runtime.profiles, ids: runtime.ids, clock: runtime.clock, iterations: 1000 },
    );
  return { runtime, fixture, server, addProfile };
}

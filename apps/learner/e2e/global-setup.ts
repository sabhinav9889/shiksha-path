import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeContentFixture } from '@shiksha/learner-core/test-helpers/content-fixture';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

/** Put the small fixture lesson packs where the built app looks for them (`/content`). */
export default async function globalSetup(): Promise<void> {
  if (!existsSync(DIST))
    throw new Error('build the app first: npm run build -w @shiksha/learner-app');
  const { outDir } = await makeContentFixture();
  const target = `${DIST}/content`;
  rmSync(target, { recursive: true, force: true });
  cpSync(outDir, target, { recursive: true });
}

import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeContentFixture } from '@shiksha/learner-core/test-helpers/content-fixture';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const LESSON_2 = 'modules/english-foundation-1/lessons/02.md';
const SPEAKING_ITEM = `  - id: s1
    type: speak_compare
    prompt: { hi: 'बोलें', en: 'Say it' }
    text: Hello, my name is Priya.
    model_audio: audio/shared.mp3
`;

/**
 * Put the small fixture lesson packs where the built app looks for them (`/content`), with a
 * speaking item added at the end of English lesson 2 for the recording tests.
 */
export default async function globalSetup(): Promise<void> {
  if (!existsSync(DIST)) {
    throw new Error('build the app first: npm run build -w @shiksha/learner-app');
  }
  const fixture = await makeContentFixture();
  await fixture.rebuild((files) => {
    const lesson = String(files[LESSON_2]);
    files[LESSON_2] = lesson.replace(
      '\n---\n<!-- lang:hi -->',
      `\n${SPEAKING_ITEM}---\n<!-- lang:hi -->`,
    );
  });
  const target = `${DIST}/content`;
  rmSync(target, { recursive: true, force: true });
  cpSync(fixture.outDir, target, { recursive: true });
}

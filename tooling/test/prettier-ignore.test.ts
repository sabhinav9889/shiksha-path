import { getFileInfo } from 'prettier';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const ignorePath = join(repoRoot, '.prettierignore');
const ignored = async (rel: string): Promise<boolean> =>
  (await getFileInfo(join(repoRoot, rel), { ignorePath })).ignored;

describe('prettier ignore', () => {
  test('lesson content is never reformatted (authors own its formatting)', async () => {
    expect(await ignored('content/modules/x/lessons/01.md')).toBe(true);
    expect(await ignored('content/tracks.yaml')).toBe(true);
  });

  test('code and docs are still formatted', async () => {
    expect(await ignored('packages/content/src/cli.ts')).toBe(false);
    expect(await ignored('docs/engineering-standards.md')).toBe(false);
  });
});

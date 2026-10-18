import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type FileMap = Record<string, string | Buffer>;

/** Write a content tree into a fresh temp directory and return its path. */
export async function makeContentDir(files: FileMap): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'content-'));
  for (const [path, data] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), data);
  }
  return root;
}

import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import { error, type ContentIssue } from './issues.js';
import type { PracticeItem } from './schema/items.js';
import type { Lesson } from './schema/lesson.js';
import type { Content, LoadedModule } from './schema/structure.js';

export const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.ogg', '.opus', '.webm'] as const;

/** One audio reference: `ref` is relative to `baseDir`; `file` is the content file naming it. */
export interface AudioRef {
  baseDir: string;
  ref: string;
  file: string;
}

export function itemAudio(items: readonly PracticeItem[]): string[] {
  return items.flatMap((item) => {
    if (item.type === 'listen_choose') return [item.audio];
    if (item.type === 'speak_compare') return [item.model_audio];
    return [];
  });
}

function lessonAudio(lesson: Lesson): string[] {
  const own = Object.values(lesson.meta.audio ?? {}).filter((a): a is string => Boolean(a));
  return [...own, ...itemAudio(lesson.meta.items)];
}

function moduleAudioRefs(root: string, mod: LoadedModule): AudioRef[] {
  const rel = relative(root, mod.dir).split('\\').join('/');
  const fromLessons = mod.lessons.flatMap((lesson) =>
    lessonAudio(lesson).map((ref) => ({ baseDir: mod.dir, ref, file: lesson.file })),
  );
  const fromTestOut = itemAudio(mod.testOut?.items ?? []).map((ref) => ({
    baseDir: mod.dir,
    ref,
    file: `${rel}/test-out.yaml`,
  }));
  return [...fromLessons, ...fromTestOut];
}

/** Every audio reference in lessons, test-outs and placement. */
export function collectAudioRefs(content: Content): AudioRef[] {
  const placementItems = content.placement?.sections.flatMap((s) => s.items) ?? [];
  const fromPlacement = itemAudio(placementItems).map((ref) => ({
    baseDir: content.placementDir,
    ref,
    file: 'placement/placement.yaml',
  }));
  return [...content.modules.flatMap((m) => moduleAudioRefs(content.root, m)), ...fromPlacement];
}

async function existsExactCase(path: string): Promise<boolean> {
  try {
    return (await readdir(dirname(path))).includes(basename(path));
  } catch {
    return false;
  }
}

/** Relative, no `..`, allowed extension, and the file exists with exactly this case. */
export async function checkAudioRef({ baseDir, ref, file }: AudioRef): Promise<ContentIssue[]> {
  const parts = ref.split(/[\\/]/);
  if (ref.startsWith('/') || /^[a-zA-Z]:/.test(ref)) {
    return [error(file, `audio "${ref}" must be a relative path`)];
  }
  if (parts.includes('..')) return [error(file, `audio "${ref}" must not contain ".."`)];
  const ext = extname(ref).toLowerCase();
  if (!(AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    const allowed = AUDIO_EXTENSIONS.join(', ');
    return [error(file, `audio "${ref}" has extension "${ext}"; allowed: ${allowed}`)];
  }
  if (!(await existsExactCase(join(baseDir, ...parts)))) {
    return [error(file, `audio "${ref}" not found (names are case-sensitive)`)];
  }
  return [];
}

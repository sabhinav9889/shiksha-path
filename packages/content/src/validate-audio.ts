import { readdir, realpath, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
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

type ListDir = (dir: string) => Promise<string[]>;

/** The one place an audio ref becomes a filesystem path (validation and build both use it). */
export const audioFilePath = (baseDir: string, ref: string): string =>
  join(baseDir, ...ref.split('/'));

/**
 * True when every segment exists with exactly this case, checked against its parent's listing,
 * so `Audio/x.mp3` fails even on case-insensitive filesystems (macOS, Windows).
 */
export async function findExactPath(
  baseDir: string,
  segments: string[],
  list: ListDir = (dir) => readdir(dir),
): Promise<boolean> {
  let current = baseDir;
  for (const segment of segments) {
    const names = await list(current).catch(() => [] as string[]);
    if (!names.includes(segment)) return false;
    current = join(current, segment);
  }
  return true;
}

function pathProblem(ref: string): string | null {
  if (ref.includes('\\')) return `audio "${ref}" contains "\\"; use "/" in audio paths`;
  if (ref.startsWith('/') || /^[a-zA-Z]:/.test(ref))
    return `audio "${ref}" must be a relative path`;
  if (ref.split('/').includes('..')) return `audio "${ref}" must not contain ".."`;
  const ext = extname(ref).toLowerCase();
  if (!(AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return `audio "${ref}" has extension "${ext}"; allowed: ${AUDIO_EXTENSIONS.join(', ')}`;
  }
  return null;
}

export type AudioResolution = { ok: true; path: string } | { ok: false; reason: string };

/**
 * The real file behind an audio reference. Symlinks are followed, and a target that resolves
 * outside `baseDir` is refused: otherwise a committed link could publish any readable file
 * (a key, an .env) as "audio" in the public build. Validation and the build both use this.
 */
export async function resolveAudio(baseDir: string, ref: string): Promise<AudioResolution> {
  const base = await realpath(baseDir).catch(() => baseDir);
  const target = await realpath(audioFilePath(baseDir, ref)).catch(() => null);
  if (target === null) return { ok: false, reason: `audio "${ref}" cannot be read (broken link?)` };
  if (!target.startsWith(base + sep)) {
    return { ok: false, reason: `audio "${ref}" resolves outside its folder (symlink?)` };
  }
  return { ok: true, path: target };
}

/** Relative, "/" only, no "..", allowed extension, exact-case path, inside its folder, a file. */
export async function checkAudioRef({ baseDir, ref, file }: AudioRef): Promise<ContentIssue[]> {
  const problem = pathProblem(ref);
  if (problem) return [error(file, problem)];
  if (!(await findExactPath(baseDir, ref.split('/')))) {
    return [error(file, `audio "${ref}" not found (names are case-sensitive)`)];
  }
  const resolved = await resolveAudio(baseDir, ref);
  if (!resolved.ok) return [error(file, resolved.reason)];
  const info = await stat(resolved.path);
  return info.isFile() ? [] : [error(file, `audio "${ref}" is not a file`)];
}

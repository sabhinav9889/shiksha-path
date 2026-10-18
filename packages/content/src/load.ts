import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import { error, fromZod, type ContentIssue } from './issues.js';
import { parseLessonFile, parseYamlSafe } from './parse-lesson.js';
import type { Lesson } from './schema/lesson.js';
import {
  moduleMeta,
  placement,
  testOut,
  tracksFile,
  type Content,
  type LoadedModule,
} from './schema/structure.js';
import { nfc, normalizeSource } from './text.js';

type Issues = ContentIssue[];

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function listEntries(path: string, kind: 'dir' | 'file'): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const wanted = entries.filter((e) => (kind === 'dir' ? e.isDirectory() : e.isFile()));
    return wanted.map((e) => e.name).sort();
  } catch {
    return [];
  }
}

/** Read, parse and validate one YAML file (`rel` is relative to the content root). */
async function readYamlFile<T>(
  root: string,
  rel: string,
  schema: z.ZodType<T>,
  issues: Issues,
): Promise<T | null> {
  const text = await readText(join(root, rel));
  if (text === null) {
    issues.push(error(rel, `missing ${rel}`));
    return null;
  }
  const data = parseYamlSafe(rel, normalizeSource(text));
  if (!data.ok) {
    issues.push(...data.issues);
    return null;
  }
  const parsed = schema.safeParse(nfc(data.value));
  if (!parsed.success) issues.push(...fromZod(rel, parsed.error.issues));
  return parsed.success ? parsed.data : null;
}

async function loadLessons(root: string, name: string, issues: Issues): Promise<Lesson[]> {
  const folder = `modules/${name}/lessons`;
  const lessons: Lesson[] = [];
  for (const fileName of await listEntries(join(root, folder), 'file')) {
    if (!fileName.endsWith('.md')) continue;
    const rel = `${folder}/${fileName}`;
    const parsed = parseLessonFile((await readText(join(root, rel))) ?? '', rel);
    if (!parsed.ok) {
      issues.push(...parsed.issues);
      continue;
    }
    if (parsed.value.meta.module !== name) {
      const message = `lesson module "${parsed.value.meta.module}" must match its folder "${name}"`;
      issues.push(error(rel, message, 'module'));
      continue;
    }
    lessons.push(parsed.value);
  }
  return lessons.sort((a, b) => a.meta.order - b.meta.order);
}

async function loadModule(
  root: string,
  name: string,
  issues: Issues,
): Promise<LoadedModule | null> {
  const metaFile = `modules/${name}/module.yaml`;
  const meta = await readYamlFile(root, metaFile, moduleMeta, issues);
  if (!meta) return null;
  if (meta.id !== name) {
    issues.push(
      error(metaFile, `module id "${meta.id}" must match its folder name "${name}"`, 'id'),
    );
    return null;
  }
  const testOutFile = `modules/${name}/test-out.yaml`;
  const loadedTestOut = await readYamlFile(root, testOutFile, testOut, issues);
  const lessons = await loadLessons(root, name, issues);
  return { dir: join(root, 'modules', name), meta, lessons, testOut: loadedTestOut };
}

/** Load the whole content tree. Collects issues and keeps going; never throws on bad content. */
export async function loadContent(root: string): Promise<{ content: Content; issues: Issues }> {
  const issues: Issues = [];
  const tracks = (await readYamlFile(root, 'tracks.yaml', tracksFile, issues)) ?? [];
  const modules: LoadedModule[] = [];
  for (const name of await listEntries(join(root, 'modules'), 'dir')) {
    const loaded = await loadModule(root, name, issues);
    if (loaded) modules.push(loaded);
  }
  const loadedPlacement = await readYamlFile(root, 'placement/placement.yaml', placement, issues);
  const placementDir = join(root, 'placement');
  return { content: { root, tracks, modules, placement: loadedPlacement, placementDir }, issues };
}

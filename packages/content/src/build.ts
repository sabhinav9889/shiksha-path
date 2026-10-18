import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  moduleBundleDraft,
  rewriteItemAudio,
  SCHEMA_VERSION,
  sha256,
  withVersion,
  type AudioEntry,
  type Manifest,
  type ManifestModule,
  type ManifestPlacement,
  type PlacementBundle,
} from './bundle.js';
import { warning, type ContentIssue } from './issues.js';
import type { Content, LoadedModule } from './schema/structure.js';
import { audioFilePath, collectAudioRefs } from './validate-audio.js';

const HASH_NAME_CHARS = 16;
const KIB = 1024;
const MIB = KIB * KIB;
const MAX_MODULE_MIB = 5;

export interface BuildResult {
  manifest: Manifest;
  issues: ContentIssue[];
}

type AudioFile = AudioEntry & { data: Buffer };
const audioKey = (baseDir: string, ref: string): string => `${baseDir}\u0000${ref}`;

/** Keep only approved content; with `preview`, keep everything (mentor preview build). */
export function selectForBuild(content: Content, opts: { preview: boolean }): Content {
  if (opts.preview) return content;
  const modules = content.modules
    .map((m) => ({
      ...m,
      lessons: m.lessons.filter((l) => l.meta.review === 'approved'),
      testOut: m.testOut?.review === 'approved' ? m.testOut : null,
    }))
    .filter((m) => m.lessons.length > 0);
  const placement = content.placement?.review === 'approved' ? content.placement : null;
  return { ...content, modules, placement };
}

async function readAudio(content: Content): Promise<Map<string, AudioFile>> {
  const files = new Map<string, AudioFile>();
  for (const { baseDir, ref } of collectAudioRefs(content)) {
    const data = await readFile(audioFilePath(baseDir, ref));
    const hash = sha256(data);
    const path = `audio/${hash.slice(0, HASH_NAME_CHARS)}${extname(ref).toLowerCase()}`;
    files.set(audioKey(baseDir, ref), { path, sha256: hash, bytes: data.length, data });
  }
  return files;
}

function pathFor(audio: Map<string, AudioFile>, baseDir: string) {
  return (ref: string): string => audio.get(audioKey(baseDir, ref))?.path ?? ref;
}

/** Unique audio entries stored under `dir` (a module folder or `placement/`), sorted by path. */
function audioUnder(audio: Map<string, AudioFile>, dir: string): AudioEntry[] {
  const own = [...audio].filter(([key]) => key.startsWith(`${dir}\u0000`)).map(([, a]) => a);
  const unique = new Map(
    own.map((a) => [a.path, { path: a.path, sha256: a.sha256, bytes: a.bytes }]),
  );
  return [...unique.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const totalBytes = (entries: AudioEntry[]): number => entries.reduce((sum, a) => sum + a.bytes, 0);

async function writeModule(
  out: string,
  mod: LoadedModule,
  audio: Map<string, AudioFile>,
): Promise<ManifestModule> {
  const entries = audioUnder(audio, mod.dir);
  const { value, json } = withVersion(moduleBundleDraft(mod, pathFor(audio, mod.dir), entries));
  const file = `modules/${value.id}.${value.version}.json`;
  await writeFile(join(out, file), json);
  return {
    id: value.id,
    track: value.track,
    title: value.title,
    order: mod.meta.order,
    version: value.version,
    file,
    sha256: sha256(json),
    bytes: Buffer.byteLength(json),
    audio_bytes: totalBytes(entries),
    lessons: mod.lessons.map((l) => ({ id: l.meta.id, order: l.meta.order, title: l.meta.title })),
  };
}

async function writePlacement(
  out: string,
  content: Content,
  audio: Map<string, AudioFile>,
): Promise<ManifestPlacement | null> {
  if (!content.placement) return null;
  const audioPath = pathFor(audio, content.placementDir);
  const sections = content.placement.sections.map((s) => ({
    ...s,
    items: s.items.map((i) => rewriteItemAudio(i, audioPath)),
  }));
  const entries = audioUnder(audio, content.placementDir);
  const draft: PlacementBundle = {
    schema_version: SCHEMA_VERSION,
    version: '',
    sections,
    audio: entries,
  };
  const { value, json } = withVersion(draft);
  const file = `placement.${value.version}.json`;
  await writeFile(join(out, file), json);
  return {
    file,
    version: value.version,
    sha256: sha256(json),
    bytes: Buffer.byteLength(json),
    audio_bytes: totalBytes(entries),
  };
}

function sizeWarnings(modules: ManifestModule[]): ContentIssue[] {
  return modules
    .filter((m) => m.bytes + m.audio_bytes > MAX_MODULE_MIB * MIB)
    .map((m) => {
      const mib = ((m.bytes + m.audio_bytes) / MIB).toFixed(1);
      const message = `module ${m.id} bundle is ${mib} MiB; target is ≤ ${MAX_MODULE_MIB} MiB`;
      return warning(`modules/${m.id}/module.yaml`, message);
    });
}

/** Write manifest, module bundles, placement and content-addressed audio into `outDir`. */
export async function writeBuild(
  content: Content,
  outDir: string,
  opts: { preview: boolean; now: Date },
): Promise<BuildResult> {
  await mkdir(join(outDir, 'modules'), { recursive: true });
  await mkdir(join(outDir, 'audio'), { recursive: true });
  const audio = await readAudio(content);
  for (const a of audio.values()) await writeFile(join(outDir, a.path), a.data);
  const ordered = [...content.modules].sort((a, b) => a.meta.order - b.meta.order);
  const modules: ManifestModule[] = [];
  for (const mod of ordered) modules.push(await writeModule(outDir, mod, audio));
  const manifest: Manifest = {
    schema_version: SCHEMA_VERSION,
    built_at: opts.now.toISOString(),
    preview: opts.preview,
    tracks: [...content.tracks].sort((a, b) => a.order - b.order),
    modules,
    placement: await writePlacement(outDir, content, audio),
  };
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { manifest, issues: sizeWarnings(modules) };
}

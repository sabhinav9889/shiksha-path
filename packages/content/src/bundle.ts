import { createHash } from 'node:crypto';
import { Marked, type Tokens } from 'marked';
import type { Localized } from './schema/localized.js';
import type { PracticeItem } from './schema/items.js';
import type { Lesson } from './schema/lesson.js';
import type { LoadedModule, PlacementSection, Track } from './schema/structure.js';

const VERSION_HEX_CHARS = 12;
export const SCHEMA_VERSION = 1;

export interface AudioEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface BundleLesson {
  id: string;
  order: number;
  topic: string;
  level: number;
  /** Lesson override, else the module's value. */
  hi_ratio: number;
  title: Localized;
  html: { hi: string; en: string };
  audio: { hi?: string; en?: string } | null;
  items: PracticeItem[];
}

export interface ModuleBundle {
  schema_version: typeof SCHEMA_VERSION;
  id: string;
  version: string;
  track: string;
  title: Localized;
  hi_ratio: number;
  lessons: BundleLesson[];
  test_out: { pass_mark: number; items: PracticeItem[] } | null;
  audio: AudioEntry[];
}

export interface PlacementBundle {
  schema_version: typeof SCHEMA_VERSION;
  version: string;
  sections: PlacementSection[];
}

export interface ManifestModule {
  id: string;
  track: string;
  title: Localized;
  order: number;
  version: string;
  file: string;
  sha256: string;
  bytes: number;
  audio_bytes: number;
  lessons: { id: string; order: number; title: Localized }[];
}

export interface Manifest {
  schema_version: typeof SCHEMA_VERSION;
  built_at: string;
  preview: boolean;
  tracks: Track[];
  modules: ManifestModule[];
  placement: { file: string; version: string; sha256: string } | null;
}

/** Maps an audio reference (relative to its folder) to its published `audio/<hash>.<ext>` path. */
export type AudioPath = (ref: string) => string;

export const sha256 = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');

/** First 12 hex characters of the SHA-256: depends only on content. */
export const bundleVersion = (json: string): string => sha256(json).slice(0, VERSION_HEX_CHARS);

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const UNSAFE_URL = /^\s*(javascript|data|vbscript):/i;

/** Lesson Markdown → HTML. Raw HTML is escaped and script URLs dropped: lesson text is data. */
const markdown = new Marked({
  async: false,
  renderer: {
    html: ({ text }: Tokens.HTML | Tokens.Tag): string => escapeHtml(text),
    link(token: Tokens.Link): string | false {
      return UNSAFE_URL.test(token.href) ? this.parser.parseInline(token.tokens) : false;
    },
    image: ({ href, text }: Tokens.Image): string | false =>
      UNSAFE_URL.test(href) ? escapeHtml(text) : false,
  },
});

export const renderMarkdown = (md: string): string => markdown.parse(md) as string;

export function rewriteItemAudio(item: PracticeItem, audioPath: AudioPath): PracticeItem {
  if (item.type === 'listen_choose') return { ...item, audio: audioPath(item.audio) };
  if (item.type === 'speak_compare') return { ...item, model_audio: audioPath(item.model_audio) };
  return item;
}

function bundleLesson(lesson: Lesson, moduleRatio: number, audioPath: AudioPath): BundleLesson {
  const { meta, body } = lesson;
  const refs = Object.entries(meta.audio ?? {}).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  const audio =
    refs.length > 0 ? Object.fromEntries(refs.map(([l, r]) => [l, audioPath(r)])) : null;
  return {
    id: meta.id,
    order: meta.order,
    topic: meta.topic,
    level: meta.level,
    hi_ratio: meta.hi_ratio ?? moduleRatio,
    title: meta.title,
    html: { hi: renderMarkdown(body.hi), en: renderMarkdown(body.en) },
    audio,
    items: meta.items.map((i) => rewriteItemAudio(i, audioPath)),
  };
}

/** A module bundle with `version: ""`; `withVersion` fills it in. */
export function moduleBundleDraft(
  mod: LoadedModule,
  audioPath: AudioPath,
  audio: AudioEntry[],
): ModuleBundle {
  const testOut = mod.testOut;
  return {
    schema_version: SCHEMA_VERSION,
    id: mod.meta.id,
    version: '',
    track: mod.meta.track,
    title: mod.meta.title,
    hi_ratio: mod.meta.hi_ratio,
    lessons: mod.lessons.map((l) => bundleLesson(l, mod.meta.hi_ratio, audioPath)),
    test_out: testOut
      ? {
          pass_mark: testOut.pass_mark,
          items: testOut.items.map((i) => rewriteItemAudio(i, audioPath)),
        }
      : null,
    audio,
  };
}

/** Compute the version over the draft (version ""), then return the final value and JSON. */
export function withVersion<T extends { version: string }>(draft: T): { value: T; json: string } {
  const value = { ...draft, version: bundleVersion(JSON.stringify(draft)) };
  return { value, json: JSON.stringify(value) };
}

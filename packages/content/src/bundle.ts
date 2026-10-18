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
  audio: AudioEntry[];
}

export interface ManifestPlacement {
  file: string;
  version: string;
  sha256: string;
  bytes: number;
  audio_bytes: number;
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
  placement: ManifestPlacement | null;
}

/** Maps an audio reference (relative to its folder) to its published `audio/<hash>.<ext>` path. */
export type AudioPath = (ref: string) => string;

export const sha256 = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');

/** First 12 hex characters of the SHA-256: depends only on content. */
export const bundleVersion = (json: string): string => sha256(json).slice(0, VERSION_HEX_CHARS);

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAMED_ENTITIES: Record<string, string> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/',
  period: '.',
  amp: '&',
  lpar: '(',
  rpar: ')',
};
const SPACE = 0x20;
const DEL = 0x7f;
const LAST_C1_CONTROL = 0x9f;
const isControlOrSpace = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  return code <= SPACE || (code >= DEL && code <= LAST_C1_CONTROL);
};
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const LINK_SCHEMES = new Set(['http', 'https', 'mailto']);

/** Decode the entities a browser would decode in an attribute, then drop control/space chars. */
function normalizeUrl(href: string): string {
  const decoded = href
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);?/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
  return [...decoded]
    .filter((ch) => !isControlOrSpace(ch))
    .join('')
    .toLowerCase();
}

/** Links: allowlist of schemes (http, https, mailto) or scheme-less (relative, #anchor). */
export function isSafeLink(href: string): boolean {
  const url = normalizeUrl(href);
  const scheme = SCHEME.exec(url)?.[1];
  if (scheme !== undefined) return LINK_SCHEMES.has(scheme);
  // An unknown entity left in the URL could still hide a scheme: reject that combination.
  const hiddenScheme = url.includes('&') && url.includes(':');
  return !hiddenScheme;
}

/** Images: local, relative paths only (no remote trackers, no protocol-relative URLs). */
export function isSafeImage(href: string): boolean {
  const url = normalizeUrl(href);
  return SCHEME.exec(url) === null && !url.startsWith('//') && !url.includes(':');
}

/** Lesson Markdown → HTML. Raw HTML is escaped and URLs are allowlisted: lesson text is data. */
const markdown = new Marked({
  async: false,
  renderer: {
    html: ({ text }: Tokens.HTML | Tokens.Tag): string => escapeHtml(text),
    link(token: Tokens.Link): string | false {
      return isSafeLink(token.href) ? false : this.parser.parseInline(token.tokens);
    },
    image: ({ href, text }: Tokens.Image): string | false =>
      isSafeImage(href) ? false : escapeHtml(text),
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

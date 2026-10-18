import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadContent, selectForBuild, validateContent, writeBuild } from '@shiksha/content';

export type FileMap = Record<string, string | Uint8Array>;

export interface ContentFixture {
  /** The built lesson packs (what a server would host). */
  outDir: string;
  /** Apply `change` to the source files, then rebuild into the same `outDir`. */
  rebuild(change?: (files: FileMap) => void): Promise<void>;
}

const BUILT_AT = new Date('2026-10-18T10:00:00Z');
const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const L = (hi: string, en: string): string => `{ hi: '${hi}', en: '${en}' }`;

const wordItem = (id: string): string => `  - id: ${id}
    type: word_order
    prompt: ${L('सही क्रम में लगाएँ', 'Put in order')}
    words: [I, am, Priya]`;

const listenItem = (id: string, audio: string): string => `  - id: ${id}
    type: listen_choose
    prompt: ${L('सुनें और चुनें', 'Listen and choose')}
    audio: ${audio}
    options:
      - { id: a, text: ${L('नमस्ते', 'Hello')}, correct: true }
      - { id: b, text: ${L('अलविदा', 'Goodbye')}, why_wrong: ${L('यह विदा है', 'That is goodbye')} }`;

interface LessonSpec {
  id: string;
  track: string;
  module: string;
  order: number;
  items: string[];
  audio?: string;
}

function lessonMd(s: LessonSpec): string {
  const audio = s.audio === undefined ? '' : `audio: { hi: ${s.audio} }\n`;
  return `---
id: ${s.id}
track: ${s.track}
module: ${s.module}
topic: basics
level: 1
order: ${s.order}
review: approved
title: ${L('पाठ ' + s.order, 'Lesson ' + s.order)}
${audio}items:
${s.items.join('\n')}
---
<!-- lang:hi -->
नमस्ते! यह पाठ ${s.order} है।
<!-- lang:en -->
Hello! This is lesson ${s.order}.
`;
}

const moduleYaml = (id: string, track: string, order: number, hiRatio: string): string =>
  `id: ${id}\ntrack: ${track}\ntitle: ${L('मॉड्यूल', 'Module')}\norder: ${order}\nhi_ratio: ${hiRatio}\n`;

const testOutYaml = (prefix: string): string =>
  `review: approved\nitems:\n${['1', '2', '3', '4', '5'].map((n) => wordItem(prefix + n)).join('\n')}\n`;

const indent = (text: string): string => text.replace(/^/gm, '    ');

/** English start rules at 0 / 0.6 / 0.9 (spec §6.3), one aptitude rule. */
function placementYaml(): string {
  const english = ['1', '2', '3', '4', '5'].map((n) => wordItem('pe' + n)).join('\n');
  const aptitude = ['1', '2'].map((n) => wordItem('pa' + n)).join('\n');
  return `review: approved
sections:
  - track: english
    items:
${indent(english)}
    start_rules:
      - { min_score: 0, start_lesson: ef1-01 }
      - { min_score: 0.6, start_lesson: ef1-02 }
      - { min_score: 0.9, start_lesson: ef1-03 }
    suggest_english_only_at: 0.9
  - track: aptitude
    items:
${indent(aptitude)}
    start_rules:
      - { min_score: 0, start_lesson: apt-01 }
`;
}

const ENGLISH = 'english-foundation-1';
const APTITUDE = 'aptitude-1';
const FOUR = ['1', '2', '3', '4'];

interface ModuleSpec {
  dir: string;
  module: string;
  track: string;
  ids: string[];
  firstAudio?: string;
}

function lessonFiles({ dir, module, track, ids, firstAudio }: ModuleSpec): FileMap {
  const plain = [...FOUR, '5'].map((n) => wordItem('q' + n));
  const withListen = [...FOUR.map((n) => wordItem('q' + n)), listenItem('q5', 'audio/shared.mp3')];
  const files: FileMap = {};
  ids.forEach((id, index) => {
    const first = index === 0;
    const spec = { id, track, module, order: index + 1, items: first ? withListen : plain };
    files[`${dir}/lessons/0${index + 1}.md`] = lessonMd(
      first && firstAudio !== undefined ? { ...spec, audio: firstAudio } : spec,
    );
  });
  return files;
}

/** Two tracks, 3 English and 2 aptitude lessons, fake audio (one file shared by both modules). */
function contentTree(): FileMap {
  const en = `modules/${ENGLISH}`;
  const apt = `modules/${APTITUDE}`;
  return {
    'tracks.yaml': `- { id: english, title: ${L('अंग्रेज़ी', 'English')}, order: 1 }\n- { id: aptitude, title: ${L('सोच', 'Aptitude')}, order: 2 }\n`,
    [`${en}/module.yaml`]: moduleYaml(ENGLISH, 'english', 1, '0.8'),
    [`${en}/test-out.yaml`]: testOutYaml('te'),
    ...lessonFiles({
      dir: en,
      module: ENGLISH,
      track: 'english',
      ids: ['ef1-01', 'ef1-02', 'ef1-03'],
      firstAudio: 'audio/intro.mp3',
    }),
    [`${en}/audio/intro.mp3`]: encode('intro-audio-bytes'),
    [`${en}/audio/shared.mp3`]: encode('shared-audio-bytes'),
    [`${apt}/module.yaml`]: moduleYaml(APTITUDE, 'aptitude', 2, '0.4'),
    [`${apt}/test-out.yaml`]: testOutYaml('ta'),
    ...lessonFiles({
      dir: apt,
      module: APTITUDE,
      track: 'aptitude',
      ids: ['apt-01', 'apt-02'],
    }),
    [`${apt}/audio/shared.mp3`]: encode('shared-audio-bytes'),
    'placement/placement.yaml': placementYaml(),
  };
}

async function writeTree(root: string, files: FileMap): Promise<void> {
  for (const [path, data] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), data);
  }
}

/** Load, validate (errors fail) and build `contentDir` into a clean `outDir`. */
export async function buildContent(contentDir: string, outDir: string): Promise<void> {
  const { content, issues } = await loadContent(contentDir);
  const all = [...issues, ...(await validateContent(content, { preview: false }))];
  const errors = all.filter((i) => i.severity === 'error');
  if (errors.length > 0) throw new Error('content is invalid: ' + JSON.stringify(errors));
  await rm(outDir, { recursive: true, force: true });
  const selected = selectForBuild(content, { preview: false });
  await writeBuild(selected, outDir, { preview: false, now: BUILT_AT });
}

export async function makeContentFixture(): Promise<ContentFixture> {
  const root = await mkdtemp(join(tmpdir(), 'learner-fixture-'));
  const contentDir = join(root, 'content');
  const outDir = join(root, 'out');
  const files = contentTree();
  const rebuild = async (change?: (f: FileMap) => void): Promise<void> => {
    change?.(files);
    await rm(contentDir, { recursive: true, force: true });
    await writeTree(contentDir, files);
    await buildContent(contentDir, outDir);
  };
  await rebuild();
  return { outDir, rebuild };
}

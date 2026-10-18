import type { FileMap } from './content-dir.js';

const L = (hi: string, en: string): string => `{ hi: '${hi}', en: '${en}' }`;

/** A word_order item, the simplest valid practice item. */
export const wordItem = (id: string): string => `  - id: ${id}
    type: word_order
    prompt: ${L('सही क्रम में लगाएँ', 'Put in order')}
    words: [I, am, Priya]`;

export const listenItem = (id: string, audio: string): string => `  - id: ${id}
    type: listen_choose
    prompt: ${L('सुनें और चुनें', 'Listen and choose')}
    audio: ${audio}
    options:
      - { id: a, text: ${L('नमस्ते', 'Hello')}, correct: true }
      - { id: b, text: ${L('अलविदा', 'Goodbye')}, why_wrong: ${L('यह विदा है', 'That is goodbye')} }`;

export interface LessonSpec {
  id: string;
  track: string;
  module: string;
  order: number;
  review?: 'approved' | 'pending';
  items?: string[];
  audio?: string;
}

export function lessonMd(s: LessonSpec): string {
  const items = s.items ?? ['q1', 'q2', 'q3', 'q4', 'q5'].map(wordItem);
  const audio = s.audio === undefined ? '' : `audio: { hi: ${s.audio} }\n`;
  return `---
id: ${s.id}
track: ${s.track}
module: ${s.module}
topic: basics
level: 1
order: ${s.order}
review: ${s.review ?? 'approved'}
title: ${L('पाठ ' + s.order, 'Lesson ' + s.order)}
${audio}items:
${items.join('\n')}
---
<!-- lang:hi -->
नमस्ते! यह पाठ ${s.order} है।
<!-- lang:en -->
Hello! This is lesson ${s.order}.
`;
}

const moduleYaml = (id: string, track: string, order: number): string =>
  `id: ${id}\ntrack: ${track}\ntitle: ${L('मॉड्यूल', 'Module')}\norder: ${order}\nhi_ratio: 0.8\n`;

const testOutYaml = (review = 'approved'): string =>
  `review: ${review}\nitems:\n${wordItem('t1')}\n`;

export const EF1 = 'modules/english-foundation-1';
export const APT = 'modules/aptitude-1';

const placementYaml = `review: approved
sections:
  - track: english
    items:
${wordItem('p1').replace(/^/gm, '    ')}
    start_rules:
      - { min_score: 0, start_lesson: ef1-01 }
      - { min_score: 0.6, start_lesson: ef1-02 }
    suggest_english_only_at: 0.9
  - track: aptitude
    items:
${wordItem('p2').replace(/^/gm, '    ')}
    start_rules:
      - { min_score: 0, start_lesson: apt-01 }
`;

/** A complete, valid content tree: 2 tracks, 2 modules, 3 approved lessons, one audio file. */
export function validFixture(): FileMap {
  const ef1 = { track: 'english', module: 'english-foundation-1' };
  const listen = listenItem('q5', 'audio/hello.mp3');
  const firstItems = [...['q1', 'q2', 'q3', 'q4'].map(wordItem), listen];
  return {
    'tracks.yaml': `- { id: english, title: ${L('अंग्रेज़ी', 'English')}, order: 1 }\n- { id: aptitude, title: ${L('सोच', 'Aptitude')}, order: 2 }\n`,
    [`${EF1}/module.yaml`]: moduleYaml('english-foundation-1', 'english', 1),
    [`${EF1}/test-out.yaml`]: testOutYaml(),
    [`${EF1}/lessons/02-name.md`]: lessonMd({ ...ef1, id: 'ef1-02', order: 2 }),
    [`${EF1}/lessons/01-greetings.md`]: lessonMd({
      ...ef1,
      id: 'ef1-01',
      order: 1,
      items: firstItems,
    }),
    [`${EF1}/audio/hello.mp3`]: Buffer.from('fake-mp3-bytes'),
    [`${APT}/module.yaml`]: moduleYaml('aptitude-1', 'aptitude', 2),
    [`${APT}/test-out.yaml`]: testOutYaml(),
    [`${APT}/lessons/01-patterns.md`]: lessonMd({
      id: 'apt-01',
      track: 'aptitude',
      module: 'aptitude-1',
      order: 1,
    }),
    'placement/placement.yaml': placementYaml,
  };
}

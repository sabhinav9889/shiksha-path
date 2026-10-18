import { describe, expect, test } from 'vitest';
import { parseLessonFile } from '../src/parse-lesson.js';

const item = (id: string): string => `  - id: ${id}
    type: word_order
    prompt: { hi: 'वाक्य बनाएँ', en: 'Make the sentence' }
    words: [I, am, Priya]`;

interface SourceOptions {
  title?: string;
  review?: string;
  items?: string[];
  body?: string;
}

function lessonSource(o: SourceOptions = {}): string {
  const items = (o.items ?? ['q1', 'q2']).map(item).join('\n');
  const body =
    o.body ??
    '<!-- lang:hi -->\nनमस्ते, आज हम Hello सीखेंगे।\n<!-- lang:en -->\nHello, today we learn greetings.\n';
  return `---
id: ef1-01-greetings
track: english
module: english-foundation-1
topic: greetings
level: 1
order: 1
review: ${o.review ?? 'approved'}
title: { hi: '${o.title ?? 'नमस्ते कहना'}', en: 'Saying hello' }
items:
${items}
---
${body}`;
}

const messages = (src: string): string[] => {
  const r = parseLessonFile(src, 'lessons/a.md');
  return r.ok ? [] : r.issues.map((i) => i.message);
};

describe('parseLessonFile', () => {
  test('parses a valid lesson', () => {
    const r = parseLessonFile(lessonSource(), 'lessons/a.md');
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.value.meta.id).toBe('ef1-01-greetings');
    expect(r.value.meta.items).toHaveLength(2);
    expect(r.value.body.hi).toContain('नमस्ते');
    expect(r.value.body.en).toContain('Hello');
    expect(r.value.file).toBe('lessons/a.md');
  });

  test('parses CRLF + BOM like LF', () => {
    const lf = parseLessonFile(lessonSource(), 'a.md');
    const crlf = parseLessonFile(
      String.fromCodePoint(0xfeff) + lessonSource().replace(/\n/g, '\r\n'),
      'a.md',
    );
    expect(crlf).toEqual(lf);
  });

  test('normalises text to NFC', () => {
    // क़ typed two ways: precomposed U+0958, or क U+0915 + nukta U+093C. Nukta letters are
    // Unicode composition exclusions, so NFC keeps them decomposed; both must end up identical.
    const precomposed = String.fromCodePoint(0x958);
    const decomposed = String.fromCodePoint(0x915, 0x93c);
    const title = (t: string): string => {
      const r = parseLessonFile(lessonSource({ title: t }), 'a.md');
      if (!r.ok) throw new Error(JSON.stringify(r.issues));
      return r.value.meta.title.hi;
    };
    expect(precomposed).not.toBe(decomposed);
    expect(title(precomposed)).toBe(title(decomposed));
    expect(title(precomposed)).toBe(precomposed.normalize('NFC'));
  });

  test('reports a missing front-matter block', () => {
    expect(messages('# no front matter\n')).toEqual([expect.stringContaining('front-matter')]);
  });

  test('reports a missing en section', () => {
    const r = parseLessonFile(lessonSource({ body: '<!-- lang:hi -->\nनमस्ते\n' }), 'a.md');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.severity).toBe('error');
    expect(r.issues[0]?.message).toContain('missing <!-- lang:en -->');
  });

  test('reports an empty hi section', () => {
    const body = '<!-- lang:hi -->\n   \n<!-- lang:en -->\nHello\n';
    expect(messages(lessonSource({ body })).join()).toContain('empty');
  });

  test('reports a duplicated language marker', () => {
    const body = '<!-- lang:hi -->\nक\n<!-- lang:hi -->\nख\n<!-- lang:en -->\nHello\n';
    expect(messages(lessonSource({ body })).join()).toContain('more than once');
  });

  test('reports text before the first marker', () => {
    const body = 'stray text\n<!-- lang:hi -->\nक\n<!-- lang:en -->\nHello\n';
    expect(messages(lessonSource({ body })).join()).toContain('before the first');
  });

  test('reports invalid review value', () => {
    const r = parseLessonFile(lessonSource({ review: 'done' }), 'a.md');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.map((i) => i.path)).toContain('review');
  });

  test('reports a nested schema path with dots', () => {
    const r = parseLessonFile(lessonSource().replace("en: 'Saying hello'", "en: ''"), 'a.md');
    expect(r.ok ? [] : r.issues.map((i) => i.path)).toContain('title.en');
  });

  test('reports invalid YAML without throwing', () => {
    expect(messages('---\ntitle: [unclosed\n---\nx\n').join()).toContain('YAML');
  });

  test('reports duplicate item ids within a lesson', () => {
    expect(messages(lessonSource({ items: ['q1', 'q1'] })).join()).toContain('q1');
  });
});

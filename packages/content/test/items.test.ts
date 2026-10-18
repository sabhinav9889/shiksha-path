import { describe, expect, test } from 'vitest';
import { ITEM_TYPES, practiceItem } from '../src/schema/items.js';

const L = (s: string): { hi: string; en: string } => ({ hi: s, en: s });
const parse = (o: object): ReturnType<typeof practiceItem.safeParse> => practiceItem.safeParse(o);
const issuesText = (o: object): string => JSON.stringify(parse(o).error?.issues ?? []);

const right = { id: 'a', text: L('A'), correct: true };
const wrong = { id: 'b', text: L('B'), why_wrong: L('w') };
const mcq = { id: 'q1', type: 'mcq_meaning', prompt: L('p'), options: [right, wrong] };

describe('practice items', () => {
  test('lists the six item types', () => {
    expect(ITEM_TYPES).toEqual([
      'mcq_meaning',
      'fill_blank',
      'word_order',
      'listen_choose',
      'speak_compare',
      'aptitude',
    ]);
  });

  test('accepts a valid mcq_meaning', () => {
    expect(parse(mcq).success).toBe(true);
  });

  test('rejects mcq with no correct option', () => {
    const options = [
      { ...right, correct: false, why_wrong: L('w') },
      { ...wrong, correct: false },
    ];
    expect(parse({ ...mcq, options }).success).toBe(false);
    expect(issuesText({ ...mcq, options })).toContain('exactly one correct');
  });

  test('rejects mcq with two correct options', () => {
    const options = [right, { ...right, id: 'c' }];
    expect(issuesText({ ...mcq, options })).toContain('exactly one correct');
  });

  test('rejects a wrong option without why_wrong', () => {
    expect(issuesText({ ...mcq, options: [right, { id: 'b', text: L('B') }] })).toMatch(
      /why_wrong.*\bb\b/,
    );
  });

  test('rejects duplicate option ids', () => {
    expect(issuesText({ ...mcq, options: [right, { ...wrong, id: 'a' }] })).toContain('unique');
  });

  test('rejects fewer than 2 or more than 6 options', () => {
    expect(parse({ ...mcq, options: [right] }).success).toBe(false);
    const many = ['b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ ...wrong, id }));
    expect(parse({ ...mcq, options: [right, ...many] }).success).toBe(false);
  });

  test('rejects empty en text', () => {
    const r = parse({ ...mcq, prompt: { hi: 'p', en: '  ' } });
    expect(r.error?.issues[0]?.path).toEqual(['prompt', 'en']);
  });

  test('applies choice rules to listen_choose and aptitude', () => {
    const bad = { options: [right, { id: 'b', text: L('B') }] };
    const listen = { ...mcq, ...bad, type: 'listen_choose', audio: 'audio/x.mp3' };
    expect(issuesText(listen)).toContain('why_wrong');
    expect(issuesText({ ...mcq, ...bad, type: 'aptitude' })).toContain('why_wrong');
    expect(parse({ ...mcq, type: 'aptitude', explanation: L('e') }).success).toBe(true);
  });

  test('fill_blank needs exactly one ___', () => {
    const base = { id: 'q2', type: 'fill_blank', prompt: L('p'), answers: ['am'] };
    expect(parse({ ...base, sentence: 'I ___ Priya.' }).success).toBe(true);
    expect(issuesText({ ...base, sentence: 'I am Priya.' })).toContain('___');
    expect(issuesText({ ...base, sentence: 'I ___ ___.' })).toContain('___');
  });

  test('word_order needs at least 2 words', () => {
    const base = { id: 'q3', type: 'word_order', prompt: L('p') };
    expect(parse({ ...base, words: ['I', 'am'] }).success).toBe(true);
    expect(parse({ ...base, words: ['I'] }).success).toBe(false);
  });

  test('speak_compare needs text and model audio', () => {
    const base = { id: 'q4', type: 'speak_compare', prompt: L('p'), text: 'Hello' };
    expect(parse({ ...base, model_audio: 'audio/hello.mp3' }).success).toBe(true);
    expect(parse(base).success).toBe(false);
  });

  test('rejects unknown type typing_test', () => {
    expect(parse({ ...mcq, type: 'typing_test' }).success).toBe(false);
  });

  test('rejects uppercase id', () => {
    expect(parse({ ...mcq, id: 'Q1' }).success).toBe(false);
  });
});

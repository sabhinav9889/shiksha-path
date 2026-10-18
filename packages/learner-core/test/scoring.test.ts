import type { PracticeItem } from '@shiksha/content/schema';
import { describe, expect, test } from 'vitest';
import { normalizeAnswer, scoreItem, type Answer } from '../src/scoring.js';

const L = (hi: string, en: string): { hi: string; en: string } => ({ hi, en });
const prompt = L('प्रश्न', 'Question');

const options = [
  { id: 'a', text: L('क', 'A'), correct: true },
  { id: 'b', text: L('ख', 'B'), why_wrong: L('ख गलत है', 'B is wrong') },
];

const mcq: PracticeItem = { id: 'q1', type: 'mcq_meaning', prompt, options };
const listen: PracticeItem = { id: 'q2', type: 'listen_choose', prompt, audio: 'audio/x', options };
const aptitude = (explanation?: { hi: string; en: string }): PracticeItem => ({
  id: 'q3',
  type: 'aptitude',
  prompt,
  options,
  ...(explanation ? { explanation } : {}),
});
const pick = (optionId: string): Answer => ({ kind: 'choice', optionId });
const text = (value: string): Answer => ({ kind: 'text', value });

describe('choice items', () => {
  test.each([mcq, listen])('$type: the right option is correct', (item) => {
    expect(scoreItem(item, pick('a'))).toEqual({
      itemId: item.id,
      outcome: 'correct',
      whyWrong: null,
      explanation: null,
      correctAnswer: null,
    });
  });

  test.each([mcq, listen])('$type: a wrong option explains why and names the right one', (item) => {
    const result = scoreItem(item, pick('b'));
    expect(result.outcome).toBe('wrong');
    expect(result.whyWrong).toEqual(L('ख गलत है', 'B is wrong'));
    expect(result.correctAnswer).toEqual({ kind: 'option', optionId: 'a' });
  });

  test('an unknown option id is a programming error', () => {
    expect(() => scoreItem(mcq, pick('zzz'))).toThrow(Error);
    expect(() => scoreItem(listen, pick('zzz'))).toThrow(Error);
  });

  test('aptitude returns its explanation for both outcomes, null when absent', () => {
    const why = L('क्योंकि', 'Because');
    expect(scoreItem(aptitude(why), pick('a')).explanation).toEqual(why);
    expect(scoreItem(aptitude(why), pick('b')).explanation).toEqual(why);
    expect(scoreItem(aptitude(), pick('a')).explanation).toBeNull();
  });
});

describe('fill_blank', () => {
  const item: PracticeItem = {
    id: 'f1',
    type: 'fill_blank',
    prompt,
    sentence: 'I ___ Priya.',
    answers: ['am'],
    common_wrong: [{ answer: 'naam', why_wrong: L('यह नाम है', 'That is a noun') }],
  };

  test('ignores case and surrounding spaces', () => {
    expect(scoreItem(item, text(' AM ')).outcome).toBe('correct');
  });

  test('Devanagari matches regardless of Unicode normalisation', () => {
    // U+0958 is a composition exclusion: NFC turns it into क (U+0915) + nukta (U+093C)
    const precomposed = String.fromCodePoint(0x0958);
    const decomposed = String.fromCodePoint(0x0915, 0x093c);
    const nukta: PracticeItem = { ...item, answers: [decomposed] } as PracticeItem;
    expect(normalizeAnswer(precomposed)).toBe(normalizeAnswer(decomposed));
    expect(scoreItem(nukta, text(precomposed)).outcome).toBe('correct');
  });

  test('empty and blank input is wrong', () => {
    expect(scoreItem(item, text('')).outcome).toBe('wrong');
    expect(scoreItem(item, text('   ')).outcome).toBe('wrong');
  });

  test('a listed wrong answer returns its reason', () => {
    const result = scoreItem(item, text('naam'));
    expect(result.whyWrong).toEqual(L('यह नाम है', 'That is a noun'));
    expect(result.correctAnswer).toEqual({ kind: 'text', value: 'am' });
  });

  test('an unlisted wrong answer has no reason but shows the answer', () => {
    const result = scoreItem(item, text('is'));
    expect([result.outcome, result.whyWrong]).toEqual(['wrong', null]);
    expect(result.correctAnswer).toEqual({ kind: 'text', value: 'am' });
  });
});

describe('word_order', () => {
  const item: PracticeItem = {
    id: 'w1',
    type: 'word_order',
    prompt,
    words: ['I', 'am', 'Priya'],
    why_wrong: L('क्रम देखें', 'Check the order'),
  };
  const order = (words: string[]): Answer => ({ kind: 'order', words });

  test('only the exact sequence is correct', () => {
    expect(scoreItem(item, order(['I', 'am', 'Priya'])).outcome).toBe('correct');
  });

  test('any other order is wrong with the item reason and the right order', () => {
    const result = scoreItem(item, order(['am', 'I', 'Priya']));
    expect(result.outcome).toBe('wrong');
    expect(result.whyWrong).toEqual(L('क्रम देखें', 'Check the order'));
    expect(result.correctAnswer).toEqual({ kind: 'order', words: ['I', 'am', 'Priya'] });
  });
});

describe('speak_compare and misuse', () => {
  const speak: PracticeItem = {
    id: 's1',
    type: 'speak_compare',
    prompt,
    text: 'Hello',
    model_audio: 'audio/h',
  };

  test('spoken answers are unscored', () => {
    expect(scoreItem(speak, { kind: 'spoken' })).toEqual({
      itemId: 's1',
      outcome: 'unscored',
      whyWrong: null,
      explanation: null,
      correctAnswer: null,
    });
  });

  test('an answer of the wrong kind throws a clear error', () => {
    expect(() => scoreItem(mcq, text('x'))).toThrow(
      'answer kind "text" does not fit item type "mcq_meaning"',
    );
  });
});

describe('normalizeAnswer', () => {
  test('trims, collapses spaces, lower-cases and composes', () => {
    expect(normalizeAnswer('  A   b  ')).toBe('a b');
    expect(normalizeAnswer('é')).toBe('é');
  });
});

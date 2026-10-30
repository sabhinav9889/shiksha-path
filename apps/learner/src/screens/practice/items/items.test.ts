// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PracticeItem } from '@shiksha/content/schema';
import { shuffleWords, type Answer } from '@shiksha/learner-core';
import { MemoryBundleStorage } from '@shiksha/learner-core/testing';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';
import ChoiceView from './ChoiceView.svelte';
import FillBlankView from './FillBlankView.svelte';
import { ITEM_VIEWS } from './registry.js';
import SpeakView from './SpeakView.svelte';
import WordOrderView from './WordOrderView.svelte';

const ITEMS_DIR = 'apps/learner/src/screens/practice/items';
const L = (hi: string, en: string): { hi: string; en: string } => ({ hi, en });
type Of<T extends PracticeItem['type']> = Extract<PracticeItem, { type: T }>;

const mcq: Of<'mcq_meaning'> = {
  id: 'q1',
  type: 'mcq_meaning',
  prompt: L('सही मतलब चुनें', 'Choose the meaning'),
  options: [
    { id: 'a', text: L('बैठक', 'Meeting'), correct: true },
    { id: 'b', text: L('छुट्टी', 'Leave'), why_wrong: L('गलत', 'Wrong') },
  ],
};
const listen: Of<'listen_choose'> = {
  ...mcq,
  type: 'listen_choose',
  audio: 'audio/0123456789abcdef.mp3',
};
const fill: Of<'fill_blank'> = {
  id: 'f1',
  type: 'fill_blank',
  prompt: L('खाली जगह भरें', 'Fill the blank'),
  sentence: 'I ___ Priya.',
  answers: ['am'],
};
const order: Of<'word_order'> = {
  id: 'w1',
  type: 'word_order',
  prompt: L('सही क्रम', 'Put in order'),
  words: ['I', 'am', 'Priya'],
};
const speak: Of<'speak_compare'> = {
  id: 's1',
  type: 'speak_compare',
  prompt: L('बोलें', 'Say it'),
  text: 'Hello, my name is Priya.',
  model_audio: 'audio/0123456789abcdef.mp3',
};

function props<I>(item: I, over: { locked?: boolean; storage?: MemoryBundleStorage } = {}) {
  const onanswer = vi.fn<(answer: Answer) => void>();
  return {
    onanswer,
    props: {
      item,
      lang: 'hi' as const,
      storage: over.storage ?? new MemoryBundleStorage(),
      seed: 'seed-1',
      locked: over.locked ?? false,
      onanswer,
    },
  };
}

const buttons = (): HTMLButtonElement[] => screen.getAllByRole('button') as HTMLButtonElement[];

describe('ChoiceView', () => {
  test('lists lettered options and answers once with the tapped option', async () => {
    const { props: p, onanswer } = props(mcq);
    render(ChoiceView, p);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /छुट्टी/ }));
    await fireEvent.click(screen.getByRole('button', { name: /बैठक/ }));
    expect(onanswer).toHaveBeenCalledTimes(1);
    expect(onanswer).toHaveBeenCalledWith({ kind: 'choice', optionId: 'b' });
  });

  test('shuffles the options per question, so the right answer is not always first', async () => {
    const four: Of<'mcq_meaning'> = {
      ...mcq,
      options: [
        { id: 'a', text: L('सही', 'Right'), correct: true },
        { id: 'b', text: L('एक', 'One'), why_wrong: L('गलत', 'Wrong') },
        { id: 'c', text: L('दो', 'Two'), why_wrong: L('गलत', 'Wrong') },
        { id: 'd', text: L('तीन', 'Three'), why_wrong: L('गलत', 'Wrong') },
      ],
    };
    const positions = new Set<number>();
    for (let n = 0; n < 24; n += 1) {
      const { props: p } = props(four);
      const { unmount } = render(ChoiceView, { ...p, seed: `q1-${n}` });
      const texts = buttons().map((b) => b.querySelector('.text')?.textContent);
      positions.add(texts.indexOf('सही'));
      expect([...texts].sort()).toEqual(['एक', 'तीन', 'दो', 'सही'].sort());
      unmount();
    }
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  test('the same question looks the same each time, letters follow what is shown, and the answer is the tapped option', async () => {
    const { props: p, onanswer } = props(mcq);
    const first = render(ChoiceView, { ...p, seed: 'q1-3' });
    const order = buttons().map((b) => b.textContent);
    first.unmount();
    render(ChoiceView, { ...p, seed: 'q1-3' });
    expect(buttons().map((b) => b.textContent)).toEqual(order);
    expect(buttons()[0]?.querySelector('.letter')?.textContent).toBe('A');
    expect(buttons()[1]?.querySelector('.letter')?.textContent).toBe('B');
    await fireEvent.click(screen.getByRole('button', { name: /छुट्टी/ }));
    expect(onanswer).toHaveBeenCalledWith({ kind: 'choice', optionId: 'b' });
  });

  test('a listening item shows a listen button when the audio is stored', async () => {
    const storage = new MemoryBundleStorage();
    await storage.putAudio(listen.audio, Uint8Array.of(1));
    render(ChoiceView, props(listen, { storage }).props);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'सुनें' })).toBeTruthy());
  });

  test('locked disables every option', () => {
    render(ChoiceView, props(mcq, { locked: true }).props);
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });
});

describe('FillBlankView', () => {
  test('puts an input where the blank is, and sends the text untrimmed', async () => {
    const { props: p, onanswer } = props(fill);
    render(FillBlankView, p);
    const check = screen.getByRole('button', { name: 'जाँचें' }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(document.body.textContent).toContain('Priya.');
    await fireEvent.input(screen.getByLabelText('आपका जवाब'), { target: { value: ' am ' } });
    expect(check.disabled).toBe(false);
    await fireEvent.click(check);
    expect(onanswer).toHaveBeenCalledWith({ kind: 'text', value: ' am ' });
  });

  test('locked disables the input and the button', () => {
    render(FillBlankView, props(fill, { locked: true }).props);
    expect((screen.getByLabelText('आपका जवाब') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'जाँचें' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('WordOrderView', () => {
  const bankWords = (): string[] =>
    Array.from(
      screen.getByTestId('bank').querySelectorAll('button'),
      (b) => b.textContent?.trim() ?? '',
    );

  test('the word bank is the deterministic shuffle for the seed', () => {
    render(WordOrderView, props(order).props);
    expect(bankWords()).toEqual(shuffleWords(order.words, 'seed-1'));
    expect(bankWords()).not.toEqual(order.words);
  });

  test('tapping words builds the sentence, tapping a placed word takes it back', async () => {
    const { props: p, onanswer } = props(order);
    render(WordOrderView, p);
    const check = screen.getByRole('button', { name: 'जाँचें' }) as HTMLButtonElement;
    for (const word of ['I', 'am']) {
      await fireEvent.click(
        screen.getByTestId('bank').querySelector(`button[data-word="${word}"]`) as Element,
      );
    }
    expect(check.disabled).toBe(true);
    await fireEvent.click(
      screen.getByTestId('tray').querySelector('button[data-word="am"]') as Element,
    );
    expect(screen.getByTestId('tray').querySelectorAll('button')).toHaveLength(1);
    for (const word of ['am', 'Priya']) {
      await fireEvent.click(
        screen.getByTestId('bank').querySelector(`button[data-word="${word}"]`) as Element,
      );
    }
    expect(check.disabled).toBe(false);
    await fireEvent.click(check);
    expect(onanswer).toHaveBeenCalledWith({ kind: 'order', words: ['I', 'am', 'Priya'] });
  });

  test('locked disables the bank and the check button', () => {
    render(WordOrderView, props(order, { locked: true }).props);
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });
});

describe('SpeakView', () => {
  test('shows the text and moves on with an unscored answer', async () => {
    const { props: p, onanswer } = props(speak);
    render(SpeakView, p);
    expect(document.body.textContent).toContain('Hello, my name is Priya.');
    await fireEvent.click(screen.getByRole('button', { name: 'आगे' }));
    expect(onanswer).toHaveBeenCalledWith({ kind: 'spoken' });
  });

  test('locked disables the next button', () => {
    render(SpeakView, props(speak, { locked: true }).props);
    expect((screen.getByRole('button', { name: 'आगे' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the registry and tap sizes', () => {
  test('has a view for every item type', () => {
    expect(Object.keys(ITEM_VIEWS).sort()).toEqual(
      [
        'aptitude',
        'fill_blank',
        'listen_choose',
        'mcq_meaning',
        'speak_compare',
        'word_order',
      ].sort(),
    );
  });

  test.each(['ChoiceView', 'FillBlankView', 'WordOrderView', 'SpeakView'])(
    '%s sets every minimum height to at least 44px',
    (name) => {
      const source = readFileSync(join(process.cwd(), ITEMS_DIR, `${name}.svelte`), 'utf8');
      const heights = [...source.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
      expect(heights.length).toBeGreaterThan(0);
      expect(heights.every((h) => h >= 44)).toBe(true);
    },
  );
});

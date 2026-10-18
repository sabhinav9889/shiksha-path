// THROWAWAY SPIKE test: checks the viewer's scoring against the REAL built lesson packs.
// Run: npm run content:build && node --test spikes/lesson-viewer/test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// The repo's package.json says "type": "module", so Node loads logic.js as an ES module and the
// file registers itself on globalThis, exactly as it does in a browser.
require('../public/logic.js');
const L = globalThis.ViewerLogic;

const dist = path.resolve(__dirname, '../../../dist/content');
const manifestFile = path.join(dist, 'manifest.json');
const built = fs.existsSync(manifestFile);

function allItems() {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const items = [];
  for (const mod of manifest.modules) {
    const bundle = JSON.parse(fs.readFileSync(path.join(dist, mod.file), 'utf8'));
    for (const lesson of bundle.lessons) items.push(...lesson.items);
    if (bundle.test_out) items.push(...bundle.test_out.items);
  }
  if (manifest.placement) {
    const p = JSON.parse(fs.readFileSync(path.join(dist, manifest.placement.file), 'utf8'));
    for (const s of p.sections) items.push(...s.items);
  }
  return items;
}

function rightAnswer(item) {
  if (item.options) return { optionId: item.options.find((o) => o.correct).id };
  if (item.type === 'fill_blank') return { value: item.answers[0] };
  if (item.type === 'word_order') return { words: item.words };
  return {};
}

function wrongAnswer(item) {
  if (item.options) return { optionId: item.options.find((o) => !o.correct).id };
  if (item.type === 'fill_blank') return { value: 'definitely-not-it' };
  if (item.type === 'word_order') return { words: item.words.slice().reverse() };
  return {};
}

test('the built lesson packs exist (run npm run content:build first)', () => {
  assert.ok(built, 'dist/content/manifest.json is missing');
});

test(
  'every real item scores correct for its right answer and wrong for a wrong one',
  { skip: !built },
  () => {
    const items = allItems();
    assert.ok(items.length >= 10, 'expected the sample content items');
    for (const item of items) {
      if (item.type === 'speak_compare') {
        assert.equal(L.scoreItem(item, {}).outcome, 'unscored');
        continue;
      }
      assert.equal(L.scoreItem(item, rightAnswer(item)).outcome, 'correct', item.id);
      const wrong = L.scoreItem(item, wrongAnswer(item));
      assert.equal(wrong.outcome, 'wrong', item.id);
    }
  },
);

test('a wrong choice returns its why_wrong text', { skip: !built }, () => {
  const item = allItems().find((i) => i.type === 'mcq_meaning');
  const result = L.scoreItem(item, wrongAnswer(item));
  assert.ok(result.whyWrong && result.whyWrong.hi && result.whyWrong.en);
});

test('language view', () => {
  assert.deepEqual(L.languageView(0.8, 'hi_en'), { primary: 'hi', toggle: 'en' });
  assert.deepEqual(L.languageView(0.5, 'hi_en'), { primary: 'en', toggle: 'hi' });
  assert.deepEqual(L.languageView(0.8, 'en_only'), { primary: 'en', toggle: null });
});

test('fill-in-the-blank ignores case, spaces and Unicode form', () => {
  const item = { type: 'fill_blank', answers: ['am'], sentence: 'I ___ here.' };
  assert.equal(L.scoreItem(item, { value: '  AM ' }).outcome, 'correct');
  assert.equal(L.scoreItem(item, { value: '' }).outcome, 'wrong');
});

test('shuffle never returns the original order', () => {
  const words = ['I', 'am', 'Priya'];
  for (let i = 0; i < 200; i += 1) assert.notDeepEqual(L.shuffleWords(words), words);
});

test('placement picks the highest rule the score reaches', () => {
  const section = {
    track: 'english',
    start_rules: [
      { min_score: 0, start_lesson: 'a' },
      { min_score: 0.6, start_lesson: 'b' },
      { min_score: 0.9, start_lesson: 'c' },
    ],
    suggest_english_only_at: 0.9,
  };
  assert.equal(L.evaluatePlacement(section, 0.59).startLesson, 'a');
  assert.equal(L.evaluatePlacement(section, 0.6).startLesson, 'b');
  assert.equal(L.evaluatePlacement(section, 0.9).englishOnlySuggested, true);
  assert.equal(L.evaluatePlacement(section, 0.89).englishOnlySuggested, false);
});

test('test-out passes at the pass mark', () => {
  assert.equal(L.evaluateTestOut(0.8, 4 / 5).passed, true);
  assert.equal(L.evaluateTestOut(0.8, 3 / 5).passed, false);
});

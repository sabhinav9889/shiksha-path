/* THROWAWAY SPIKE: not the product. A quick re-implementation of the rules in
   docs/superpowers/plans/2026-10-18-learner-core.md so the real lesson packs can be tried in a
   browser. Plan 2a builds the real, tested version in packages/learner-core. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ViewerLogic = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const HINDI_PRIMARY_ABOVE = 0.5;
  const EPSILON = 1e-9;

  /** hi_en: Hindi first when the module is mostly Hindi; en_only: English, no toggle. */
  function languageView(hiRatio, pref) {
    if (pref === 'en_only') return { primary: 'en', toggle: null };
    return hiRatio > HINDI_PRIMARY_ABOVE
      ? { primary: 'hi', toggle: 'en' }
      : { primary: 'en', toggle: 'hi' };
  }

  function normalize(text) {
    return String(text).normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function scoreChoice(item, optionId) {
    const chosen = item.options.find((o) => o.id === optionId);
    if (!chosen) throw new Error('unknown option ' + optionId);
    const right = item.options.find((o) => o.correct === true);
    const ok = chosen.correct === true;
    return {
      outcome: ok ? 'correct' : 'wrong',
      whyWrong: ok ? null : chosen.why_wrong || null,
      explanation: item.explanation || null,
      correct: { kind: 'option', optionId: right.id, text: right.text },
    };
  }

  function scoreFill(item, value) {
    const given = normalize(value);
    const ok = given !== '' && item.answers.some((a) => normalize(a) === given);
    const known = (item.common_wrong || []).find((w) => normalize(w.answer) === given);
    return {
      outcome: ok ? 'correct' : 'wrong',
      whyWrong: ok || !known ? null : known.why_wrong,
      explanation: null,
      correct: { kind: 'text', value: item.answers[0] },
    };
  }

  function scoreOrder(item, words) {
    const ok = words.length === item.words.length && words.every((w, i) => w === item.words[i]);
    return {
      outcome: ok ? 'correct' : 'wrong',
      whyWrong: ok ? null : item.why_wrong || null,
      explanation: null,
      correct: { kind: 'order', words: item.words },
    };
  }

  /** One attempt per item. Speaking items are never scored. */
  function scoreItem(item, answer) {
    switch (item.type) {
      case 'mcq_meaning':
      case 'listen_choose':
      case 'aptitude':
        return scoreChoice(item, answer.optionId);
      case 'fill_blank':
        return scoreFill(item, answer.value);
      case 'word_order':
        return scoreOrder(item, answer.words);
      case 'speak_compare':
        return { outcome: 'unscored', whyWrong: null, explanation: null, correct: null };
      default:
        throw new Error('unknown item type ' + item.type);
    }
  }

  /** Never returns the original order when a different order exists. */
  function shuffleWords(words, random) {
    const rnd = random || Math.random;
    const out = words.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    const same = out.every((w, i) => w === words[i]);
    if (same && new Set(words).size > 1) out.push(out.shift());
    return out;
  }

  function summarize(results) {
    const count = (o) => results.filter((r) => r.outcome === o).length;
    const correct = count('correct');
    const wrong = count('wrong');
    const scored = correct + wrong;
    return {
      total: results.length,
      scored,
      correct,
      wrong,
      unscored: count('unscored'),
      score: scored === 0 ? 1 : correct / scored,
    };
  }

  /** Start lesson = the rule with the highest min_score that the score reaches. */
  function evaluatePlacement(section, score) {
    const rules = section.start_rules.slice().sort((a, b) => b.min_score - a.min_score);
    const hit = rules.find((r) => score + EPSILON >= r.min_score) || rules[rules.length - 1];
    const at = section.suggest_english_only_at;
    return {
      track: section.track,
      score,
      startLesson: hit.start_lesson,
      englishOnlySuggested: at !== undefined && score + EPSILON >= at,
    };
  }

  function evaluateTestOut(passMark, score) {
    return { score, passed: score + EPSILON >= passMark };
  }

  return {
    languageView,
    normalize,
    scoreItem,
    shuffleWords,
    summarize,
    evaluatePlacement,
    evaluateTestOut,
  };
});

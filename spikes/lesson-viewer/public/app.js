/* THROWAWAY SPIKE: not the product. Plain browser JavaScript that shows the real lesson packs
   built by `npm run content:build`. Text from the packs is always set as text; only the lesson
   body HTML (escaped and link-filtered by the content builder) is inserted as HTML. */
(function () {
  'use strict';

  const L = window.ViewerLogic;
  const app = document.getElementById('app');
  const state = { manifest: null, modules: new Map(), pref: loadPref(), rerender: null };
  const PLACEMENT_HI_RATIO = 0.8;

  function loadPref() {
    try {
      return localStorage.getItem('viewer-pref') === 'en_only' ? 'en_only' : 'hi_en';
    } catch {
      return 'hi_en';
    }
  }

  function savePref(pref) {
    state.pref = pref;
    try {
      localStorage.setItem('viewer-pref', pref);
    } catch {
      /* private window: the choice just won't be remembered */
    }
  }

  /** Tiny element builder. Strings become text nodes, never HTML. */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) el.setAttribute(key, value === true ? '' : value);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const dual = (l) => (state.pref === 'en_only' ? l.en : l.hi + ' / ' + l.en);

  function bothLangs(l, view) {
    const other = view.toggle ? l[view.toggle] : null;
    return other && other !== l[view.primary] ? l[view.primary] + ' · ' + other : l[view.primary];
  }

  function promptBlock(l, view) {
    return h(
      'div',
      { class: 'prompt' },
      h('p', { class: 'primary-text' }, l[view.primary]),
      view.toggle ? h('p', { class: 'secondary-text' }, l[view.toggle]) : null,
    );
  }

  function topBar() {
    const choice = (pref, label) =>
      h(
        'button',
        {
          class: state.pref === pref ? 'on' : '',
          'aria-pressed': String(state.pref === pref),
          onclick: () => {
            savePref(pref);
            if (state.rerender) guarded(state.rerender);
          },
        },
        label,
      );
    return h(
      'div',
      { class: 'topbar' },
      h(
        'a',
        { href: '#', onclick: (e) => (e.preventDefault(), guarded(showHome)) },
        'Shiksha Path',
      ),
      h('span', { class: 'badge' }, 'THROWAWAY SPIKE'),
      h(
        'div',
        { class: 'lang' },
        choice('hi_en', 'हिंदी + English'),
        choice('en_only', 'English only'),
      ),
    );
  }

  function render(...nodes) {
    app.replaceChildren(topBar(), ...nodes);
    window.scrollTo(0, 0);
  }

  async function guarded(fn) {
    try {
      await fn();
    } catch (e) {
      render(h('p', { class: 'error' }, 'Something went wrong: ' + (e && e.message)));
    }
  }

  /** Download one file listed in the manifest and check its SHA-256 before using it. */
  async function getVerified(entry) {
    const res = await fetch('/content/' + entry.file, { cache: 'no-store' });
    if (!res.ok) throw new Error(entry.file + ' → HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    let verified = 'unavailable';
    if (window.crypto && window.crypto.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
        '',
      );
      if (hex !== entry.sha256)
        throw new Error('Checksum mismatch for ' + entry.file + ': refusing to show it');
      verified = 'ok';
    }
    return { bundle: JSON.parse(new TextDecoder().decode(buf)), verified };
  }

  function loadModule(id) {
    if (!state.modules.has(id)) {
      const entry = state.manifest.modules.find((m) => m.id === id);
      const pending = getVerified(entry).catch((e) => {
        state.modules.delete(id);
        throw e;
      });
      state.modules.set(id, pending);
    }
    return state.modules.get(id);
  }

  // ----- screens ---------------------------------------------------------------------------

  async function showHome() {
    state.rerender = showHome;
    const m = state.manifest;
    const tracks = [...m.tracks].sort((a, b) => a.order - b.order);
    const modulesOf = (track) =>
      m.modules.filter((mod) => mod.track === track.id).sort((a, b) => a.order - b.order);
    render(
      h(
        'p',
        { class: 'muted' },
        `Built ${m.built_at} · preview build: ${m.preview} · ${m.modules.length} modules`,
      ),
      m.placement
        ? h(
            'button',
            { class: 'btn primary', onclick: () => guarded(startPlacement) },
            'Take the placement test',
          )
        : null,
      ...tracks.map((track) =>
        h(
          'section',
          { class: 'card' },
          h('h2', {}, dual(track.title)),
          ...modulesOf(track).map((mod) =>
            h(
              'div',
              {},
              h('h3', {}, dual(mod.title)),
              h(
                'div',
                { class: 'lesson-list' },
                ...[...mod.lessons]
                  .sort((a, b) => a.order - b.order)
                  .map((lesson) =>
                    h(
                      'button',
                      { class: 'btn', onclick: () => guarded(() => showLesson(mod.id, lesson.id)) },
                      `Lesson ${lesson.order}: ${dual(lesson.title)}`,
                    ),
                  ),
                h(
                  'button',
                  { class: 'btn', onclick: () => guarded(() => startTestOut(mod.id)) },
                  'Test-out quiz',
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  async function showLesson(moduleId, lessonId) {
    state.rerender = () => showLesson(moduleId, lessonId);
    const { bundle, verified } = await loadModule(moduleId);
    const lesson = bundle.lessons.find((l) => l.id === lessonId);
    const view = L.languageView(lesson.hi_ratio, state.pref);
    let shown = view.primary;
    const body = h('div', { class: 'lesson-body' });
    const toggle = view.toggle
      ? h(
          'button',
          {
            class: 'btn',
            onclick: () => ((shown = shown === view.primary ? view.toggle : view.primary), draw()),
          },
          '',
        )
      : null;
    function draw() {
      body.innerHTML = lesson.html[shown];
      if (toggle) toggle.textContent = shown === 'hi' ? 'Show English' : 'हिंदी में देखें';
    }
    draw();
    const audioPath = lesson.audio && (lesson.audio[shown] || lesson.audio.hi || lesson.audio.en);
    render(
      h(
        'div',
        { class: 'card' },
        h('h1', {}, dual(lesson.title)),
        h(
          'p',
          { class: 'muted' },
          `${bundle.title.en} · hi_ratio ${lesson.hi_ratio} → ${view.primary} first · `,
          verified === 'ok'
            ? '✓ checksum verified (sha-256)'
            : 'checksum not checked (no Web Crypto)',
        ),
        toggle,
        body,
        audioPath ? h('audio', { controls: true, src: '/content/' + audioPath }) : null,
      ),
      h(
        'div',
        { class: 'card' },
        h(
          'button',
          {
            class: 'btn primary',
            onclick: () =>
              runQuiz({
                items: lesson.items,
                hiRatio: lesson.hi_ratio,
                onDone: (done) => showSummary(dual(lesson.title), done, []),
              }),
          },
          `Practice (${lesson.items.length} questions)`,
        ),
      ),
      h(
        'details',
        { class: 'card' },
        h('summary', {}, 'Show this lesson as stored in the pack (JSON)'),
        h('pre', {}, JSON.stringify(lesson, null, 2)),
      ),
    );
  }

  async function startTestOut(moduleId) {
    const { bundle } = await loadModule(moduleId);
    if (!bundle.test_out) throw new Error('This module has no approved test-out quiz in the pack.');
    const { pass_mark: passMark, items } = bundle.test_out;
    runQuiz({
      items,
      hiRatio: bundle.hi_ratio,
      onDone: (done) => {
        const summary = L.summarize(done.map((d) => d.result));
        const out = L.evaluateTestOut(passMark, summary.score);
        const note = out.passed
          ? '✓ Passed: this module would be marked complete.'
          : `Not passed yet (pass mark ${passMark * 100}%).`;
        showSummary(dual(bundle.title) + ' · test-out', done, [
          h('p', { class: 'primary-text' }, note),
        ]);
      },
    });
  }

  async function startPlacement() {
    const entry = state.manifest.placement;
    const { bundle } = await getVerified(entry);
    const queue = bundle.sections.flatMap((s) => s.items.map((item) => ({ item, track: s.track })));
    runQuiz({
      items: queue.map((q) => q.item),
      hiRatio: PLACEMENT_HI_RATIO,
      onDone: (done) => {
        const lines = bundle.sections.map((section) => {
          const mine = done.filter((_, i) => queue[i].track === section.track).map((d) => d.result);
          const out = L.evaluatePlacement(section, L.summarize(mine).score);
          const extra = out.englishOnlySuggested ? ' · "English only" would be suggested' : '';
          return h(
            'p',
            {},
            `${section.track}: score ${Math.round(out.score * 100)}% → start at ${out.startLesson}${extra}`,
          );
        });
        showSummary('Placement test', done, lines);
      },
    });
  }

  // ----- quiz ------------------------------------------------------------------------------

  const correctText = (c, view) =>
    c.kind === 'option' ? bothLangs(c.text, view) : c.kind === 'text' ? c.value : c.words.join(' ');

  function feedback(result, view) {
    const box = h('div', { class: 'feedback ' + result.outcome });
    if (result.outcome === 'correct') box.append(h('strong', {}, '✓ Correct · सही'));
    else if (result.outcome === 'wrong') {
      box.append(h('strong', {}, '✗ Not quite · गलत'));
      if (result.whyWrong) box.append(promptBlock(result.whyWrong, view));
      else
        box.append(
          h('p', { class: 'secondary-text' }, '(this item has no why_wrong in the content)'),
        );
      box.append(h('p', {}, 'Correct answer: ' + correctText(result.correct, view)));
    } else box.append(h('strong', {}, 'Skipped: speaking items are not scored'));
    if (result.explanation) box.append(promptBlock(result.explanation, view));
    return box;
  }

  function choiceList(item, view, answer) {
    let locked = false;
    const pairs = item.options.map((opt) => {
      const button = h(
        'button',
        {
          class: 'option',
          onclick: () => {
            if (locked) return;
            locked = true;
            const result = answer({ optionId: opt.id });
            for (const [o, b] of pairs)
              if (o.id === result.correct.optionId) b.classList.add('right');
            if (result.outcome === 'wrong') button.classList.add('wrong');
          },
        },
        bothLangs(opt.text, view),
      );
      return [opt, button];
    });
    return h(
      'div',
      { class: 'options' },
      pairs.map(([, b]) => b),
    );
  }

  function fillBlank(item, answer) {
    const [before, after] = item.sentence.split('___');
    const input = h('input', { type: 'text', 'aria-label': 'answer', autocomplete: 'off' });
    let locked = false;
    function submit() {
      if (locked) return;
      locked = true;
      input.disabled = true;
      check.disabled = true;
      answer({ value: input.value });
    }
    const check = h('button', { class: 'btn primary', onclick: submit }, 'Check');
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    return h('div', {}, h('p', { class: 'primary-text' }, before, input, after), check);
  }

  function wordOrder(item, answer) {
    const pool = L.shuffleWords(item.words);
    const chosen = [];
    let locked = false;
    const poolEl = h('div', { class: 'chips' });
    const outEl = h('div', { class: 'chips' });
    const chip = (word, onclick) =>
      h('button', { class: 'chip', onclick: () => !locked && onclick() }, word);
    function draw() {
      poolEl.replaceChildren(
        ...pool.flatMap((w, i) =>
          chosen.includes(i) ? [] : [chip(w, () => (chosen.push(i), draw()))],
        ),
      );
      outEl.replaceChildren(
        ...chosen.map((i) => chip(pool[i], () => (chosen.splice(chosen.indexOf(i), 1), draw()))),
      );
      check.disabled = chosen.length !== pool.length;
    }
    function submit() {
      locked = true;
      check.disabled = true;
      answer({ words: chosen.map((i) => pool[i]) });
    }
    const check = h('button', { class: 'btn primary', disabled: true, onclick: submit }, 'Check');
    draw();
    return h(
      'div',
      {},
      h('p', { class: 'secondary-text' }, 'Tap the words in the right order'),
      outEl,
      poolEl,
      check,
    );
  }

  function speak(item, answer) {
    return h(
      'div',
      {},
      h('p', { class: 'primary-text' }, item.text),
      h('audio', { controls: true, src: '/content/' + item.model_audio }),
      h(
        'button',
        { class: 'btn', onclick: () => answer({}) },
        'Skip (recording is not part of this spike)',
      ),
    );
  }

  function itemCard(item, view, answer) {
    const card = h('div', { class: 'card' }, promptBlock(item.prompt, view));
    if (item.type === 'listen_choose')
      card.append(h('audio', { controls: true, src: '/content/' + item.audio }));
    if (item.type === 'fill_blank') card.append(fillBlank(item, answer));
    else if (item.type === 'word_order') card.append(wordOrder(item, answer));
    else if (item.type === 'speak_compare') card.append(speak(item, answer));
    else card.append(choiceList(item, view, answer));
    return card;
  }

  /** One question at a time. `onDone(done)` gets [{ item, result }]. */
  function runQuiz({ items, hiRatio, onDone }) {
    state.rerender = null;
    const view = L.languageView(hiRatio, state.pref);
    const done = [];
    let index = 0;
    function showItem() {
      if (index >= items.length) return onDone(done);
      const item = items[index];
      let card;
      const answer = (given) => {
        const result = L.scoreItem(item, given);
        done.push({ item, result });
        const last = index === items.length - 1;
        card.append(
          feedback(result, view),
          h(
            'button',
            { class: 'btn primary', onclick: () => ((index += 1), showItem()) },
            last ? 'See results' : 'Next',
          ),
        );
        return result;
      };
      card = itemCard(item, view, answer);
      render(
        h('p', { class: 'muted' }, `Question ${index + 1} / ${items.length} · ${item.type}`),
        card,
      );
    }
    showItem();
  }

  function showSummary(title, done, extra) {
    const s = L.summarize(done.map((d) => d.result));
    const view = L.languageView(PLACEMENT_HI_RATIO, state.pref);
    const mistakes = done.filter((d) => d.result.outcome === 'wrong');
    render(
      h(
        'div',
        { class: 'card' },
        h('h2', {}, title),
        h('p', { class: 'big' }, `${s.correct} / ${s.scored} correct`),
        s.unscored ? h('p', { class: 'muted' }, `${s.unscored} not scored`) : null,
        ...extra,
      ),
      mistakes.length
        ? h(
            'div',
            { class: 'card' },
            h('h3', {}, 'To review later'),
            ...mistakes.map((m) =>
              h(
                'div',
                {},
                promptBlock(m.item.prompt, view),
                h(
                  'p',
                  { class: 'muted' },
                  'Correct answer: ' + correctText(m.result.correct, view),
                ),
              ),
            ),
          )
        : null,
      h('button', { class: 'btn primary', onclick: () => guarded(showHome) }, 'Back to lessons'),
    );
  }

  async function init() {
    try {
      const res = await fetch('/content/manifest.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.manifest = await res.json();
      await showHome();
    } catch (e) {
      app.replaceChildren(
        h(
          'p',
          { class: 'error' },
          'Could not load /content/manifest.json (' + e.message + '). Run: npm run content:build',
        ),
      );
    }
  }

  init();
})();

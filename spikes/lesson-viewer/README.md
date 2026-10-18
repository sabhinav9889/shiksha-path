# Lesson viewer: THROWAWAY SPIKE

**This is an experiment, not part of the product.** It exists so you can click through the real
lesson packs in a browser before the real learner app (Plans 2a and 2b) is built. It lives only on
the local branch `spike/lesson-viewer`; it is not pushed and has no pull request.

## Run it

```bash
cd ~/shiksha-path
git checkout spike/lesson-viewer
npm run viewer
```

Then open the address it prints (normally <http://localhost:5173>). Stop with `Ctrl+C`.
`npm run viewer` first runs `npm run content:build`, so edit anything in `content/`, run it again,
and the page shows your change.

## What you can try

- The home page lists the tracks, modules and lessons from `manifest.json`.
- **A lesson** shows its Hindi or English text (Hindi first when the module is mostly Hindi), a
  checksum badge (the page re-computes the SHA-256 and refuses a pack that doesn't match), and a
  "show as stored" panel with the raw JSON of the pack.
- **Practice** runs the lesson's questions: multiple choice, aptitude, fill in the blank and word
  order. A wrong answer shows its `why_wrong`.
- **Test-out quiz** and **placement test** use the same questions logic. The placement test says
  where you would start.
- The top-right switch changes between "Hindi + English" and "English only".

## What it is not

- Scoring and language rules here are a quick re-implementation. The tested versions are built in
  Plan 2a (`packages/learner-core`).
- No saved progress, review queue, streak, offline mode, recording or sign-in.
- Speaking questions are skipped (`speak_compare`).
- The server listens on `127.0.0.1` only.

## Check the logic

```bash
npm run content:build && node --test spikes/lesson-viewer/test/logic.test.cjs
```

## Delete it

```bash
git checkout main
git branch -D spike/lesson-viewer   # or: rm -rf spikes/lesson-viewer
```

Keeping anything from it means a new request: the real app is built from the plans, with tests.

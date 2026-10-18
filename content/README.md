# Writing lessons for Shiksha Path

Everything students learn lives in this folder as plain text files. A build step checks them and
turns them into small downloadable packs for the app.

## Folder layout

```
content/
  tracks.yaml                          # the learning tracks (English, Aptitude, …)
  placement/placement.yaml             # the first-launch placement test
  placement/audio/                     # audio used by the placement test
  modules/<module-id>/module.yaml      # module title, track, order, Hindi/English mix
  modules/<module-id>/test-out.yaml    # quiz that lets a student skip the module
  modules/<module-id>/lessons/*.md     # one file per lesson
  modules/<module-id>/audio/           # audio used by this module
```

IDs use lowercase letters, numbers and dashes only: `english-foundation-1`, `ef1-02-my-name`.

## A lesson file

A lesson has a header between `---` lines (YAML) and then the lesson text in **both** languages.

```markdown
---
id: ef1-02-my-name
track: english
module: english-foundation-1
topic: introducing yourself
level: 1
order: 2 # position inside the module
review: pending # becomes approved after mentor review
title: { hi: अपना नाम बताना, en: Saying your name }
audio: { hi: audio/ef1-02-hi.mp3 } # optional, relative to the module folder
items:
  - id: q1
    type: word_order
    prompt: { hi: सही क्रम में लगाएँ, en: Put the words in order }
    words: [My, name, is, Priya]
---

<!-- lang:hi -->

हिंदी में समझाना (English शब्दों के साथ)…

<!-- lang:en -->

The English-only version of the same lesson…
```

Both `<!-- lang:hi -->` and `<!-- lang:en -->` sections are required. Students who chose "English
only" see the English section. Every `hi`/`en` pair must have text in both languages.

Lessons should have **5 to 10 practice items**.

## Practice item types

| type            | What the student does         | Fields besides `id`, `type`, `prompt`                                  |
| --------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `mcq_meaning`   | Picks the right meaning       | `options` (2–6)                                                        |
| `aptitude`      | Solves a puzzle               | `options` (2–6), optional `explanation`                                |
| `listen_choose` | Listens, then picks           | `audio`, `options` (2–6)                                               |
| `fill_blank`    | Types the missing word        | `sentence` with exactly one `___`, `answers`, optional `common_wrong`  |
| `word_order`    | Puts words in the right order | `words` (in the correct order; the app shuffles), optional `why_wrong` |
| `speak_compare` | Records and compares          | `text` to say, `model_audio` (a mentor's recording)                    |

**Options rules:** exactly one option has `correct: true`, option ids are unique, and **every
wrong option has a `why_wrong`** in Hindi and English. That explanation is what the student sees
offline after a wrong answer, so keep it short and kind.

## Links and pictures in lesson text

- Links may point to `https://`, `http://` or `mailto:` addresses, or to other lesson pages.
  Anything else (for example `javascript:`) is shown as plain text.
- Pictures must be files inside this folder (`images/diagram.png`). Pictures from the internet
  are not shown: the app works offline and must not load outside content on students' phones.
- HTML tags typed into a lesson are shown as text, not run.

## Review status

- `review: pending` – drafted, not yet checked. Left out of the real build; included in the mentor
  preview build.
- `review: approved` – checked by a mentor. Included in the build.

The same applies to `test-out.yaml` and `placement.yaml`: if they're pending, the build leaves
them out and prints a warning.

The placement test may only start students at **approved** lessons.

## Audio

- Allowed types: `.mp3`, `.m4a`, `.ogg`, `.opus`, `.webm`.
- Paths are relative to the module folder (or `placement/`), e.g. `audio/hello.mp3`. Always use
  `/`, never `\`.
- File names are **case-sensitive**: `Hello.mp3` and `hello.mp3` are different files.
- Keep each module under about 5 MB in total.

## Check and build

```bash
npm run content:check            # validate only
npm run content:build            # build into dist/content
npm run content:build -- --preview   # include pending lessons (mentor preview)
```

Errors name the file and the field, for example
`error modules/aptitude-1/module.yaml title: Invalid input`. Fix them and run the check again.
Files in this folder are not auto-formatted, so your layout is kept as you wrote it.

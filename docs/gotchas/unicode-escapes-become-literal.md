# `\u` escapes can turn into invisible literal characters

**What breaks:** a `﻿` (BOM) or `क़` written in source can end up in the file as
the literal, invisible character. Code still runs, but reviewers can't see it, Devanagari tests
silently compare the wrong thing, and ESLint reports `no-irregular-whitespace`.

**Why:** some editing paths (including AI tool output) decode escape sequences before the file is
written. Prettier itself preserves escapes.

**How to avoid:** for invisible or combining characters, build them from code points:
`String.fromCodePoint(0xfeff)`, `String.fromCodePoint(0x915, 0x93c)`. Scan with
`grep -rlP '\x{FEFF}|\x{200B}|\x{00A0}' packages tooling`.

**Related Devanagari fact:** nukta letters (क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़) are Unicode composition
exclusions, so NFC keeps them decomposed (क + ़). Compare normalised strings; never expect NFC to
produce the precomposed code point.

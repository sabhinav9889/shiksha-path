# A commit body line that looks like `word: text` is read as a footer

**What breaks:** `git commit` fails with `footer must have leading blank line [footer-leading-blank]`
although the message looks fine. A body line such as `today: a streak counts only…` starts a footer
in commitlint's parser.

**Why:** the Conventional Commits parser treats any `token: value` or `token #value` line after the
first paragraph as a footer, and footers need a blank line before them.

**How to avoid:** don't start a body line with a single word and a colon. Rephrase ("Staff screens
now read the summary as it stands now"). Put the `Co-Authored-By:` trailer last, after a blank line.

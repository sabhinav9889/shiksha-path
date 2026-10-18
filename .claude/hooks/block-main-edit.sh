#!/usr/bin/env bash
# PreToolUse(Edit|Write): refuse edits while the checkout is on main.
# Allows a detached HEAD (rebase in progress) and a repo with no commits yet.
set -uo pipefail
cat > /dev/null

dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
git -C "$dir" rev-parse --verify -q HEAD > /dev/null || exit 0
branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"

if [[ "$branch" == "main" ]]; then
  echo "Editing on main is blocked – create a feature branch: git checkout -b feature/<slug>" >&2
  exit 2
fi
exit 0

#!/usr/bin/env bash
# PreToolUse(Edit|Write): refuse edits to files in a checkout that is on main, or in a checkout
# whose git hooks aren't installed yet (fresh clone/worktree before `npm ci`).
# The branch is taken from the EDITED FILE's checkout, not the session's, so worktrees work.
# Allows: files outside any git repo, a detached HEAD, a repo with no commits yet.
set -uo pipefail

dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')"
[[ -z "$file" ]] && exit 0
[[ "$file" != /* ]] && file="$dir/$file"

# Nearest existing directory of the target (the file may not exist yet).
target="$(dirname -- "$file")"
while [[ ! -d "$target" && "$target" != "/" ]]; do target="$(dirname -- "$target")"; done

top="$(git -C "$target" rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [[ -d "$top/.husky" && ! -d "$top/.husky/_" ]]; then
  echo "Git hooks are not installed in $top – run 'npm ci' there before editing." >&2
  exit 2
fi

git -C "$top" rev-parse --verify -q HEAD > /dev/null || exit 0
branch="$(git -C "$top" branch --show-current 2>/dev/null || true)"

if [[ "$branch" == "main" ]]; then
  echo "Editing on main is blocked ($top) – create a feature branch: git checkout -b feature/<slug>" >&2
  exit 2
fi
exit 0

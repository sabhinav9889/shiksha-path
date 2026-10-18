#!/usr/bin/env bash
# PostToolUse(Edit|Write): format the edited file with Prettier (best effort, never blocks).
set -uo pipefail

dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
path="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')"

case "$path" in
  *.ts | *.js | *.svelte | *.json | *.md | *.yml | *.yaml)
    (cd "$dir" && npx --no prettier --write --ignore-unknown "$path" > /dev/null 2>&1) || true
    ;;
esac
exit 0

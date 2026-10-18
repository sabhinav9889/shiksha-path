#!/usr/bin/env bash
# PreToolUse(Edit|Write): refuse writes to secret files (.env*, keys, credentials).
# .env.example is allowed: it documents variable names without values.
set -uo pipefail

path="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')"
name="$(basename -- "${path:-x}")"

case "$name" in
  .env.example) exit 0 ;;
  .env | .env.* | *.pem | *.key | credentials*.json)
    echo "Writing secret files ($name) is blocked – put secrets in environment settings." >&2
    exit 2
    ;;
  *) exit 0 ;;
esac

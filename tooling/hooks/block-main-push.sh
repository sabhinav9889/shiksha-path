#!/usr/bin/env bash
# git pre-push hook: refuse pushes that update main. Free private repos have no
# server-side branch protection, so this is the guard until the repo moves to a
# GitHub for Nonprofits org or Pro (docs/gotchas/github-free-private-no-branch-protection.md).
set -euo pipefail

while read -r _local_ref _local_sha remote_ref _remote_sha; do
  if [[ "$remote_ref" == "refs/heads/main" ]]; then
    echo "Direct push to main is blocked – open a PR from a feature branch." >&2
    exit 1
  fi
done

exit 0

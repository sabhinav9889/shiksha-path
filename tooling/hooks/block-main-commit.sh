#!/usr/bin/env bash
# git pre-commit: refuse commits on main. Allows the first commit of a new repo and a detached HEAD.
# Merges to main happen through pull requests on GitHub.
set -uo pipefail

git rev-parse --verify -q HEAD > /dev/null || exit 0
if [[ "$(git branch --show-current)" == "main" ]]; then
  echo "Committing on main is blocked – create a feature branch: git checkout -b feature/<slug>" >&2
  exit 1
fi
exit 0

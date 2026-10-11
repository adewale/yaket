#!/usr/bin/env bash
# Prepare the upstream Python YAKE reference that the parity tests compare
# against (test/python-parity, test/differential-fuzz, test/seqm-parity).
#
# The reference is pinned to one upstream commit so that a change in upstream
# YAKE cannot silently change the oracle. To move the pin, update YAKE_COMMIT,
# run `npm run test:python-parity` locally, and record any intended drift in
# docs/algorithm-drift.md.
set -euo pipefail

YAKE_COMMIT="f7944f645106d8c37c6999a1ba66d222f215a151" # INESCTEC/yake, 2026-02-09
dest="${YAKET_PYTHONPATH:-/tmp/yake}"

if [[ -e "$dest" ]]; then
  echo "setup-python-parity: $dest already exists; remove it or set YAKET_PYTHONPATH" >&2
  exit 1
fi

git init --quiet "$dest"
git -C "$dest" fetch --quiet --depth 1 https://github.com/INESCTEC/yake.git "$YAKE_COMMIT"
git -C "$dest" checkout --quiet --detach FETCH_HEAD
python3 -m pip install -r "$(dirname "$0")/python-parity-requirements.txt"
echo "setup-python-parity: YAKE $(git -C "$dest" rev-parse HEAD) at $dest"

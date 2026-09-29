#!/usr/bin/env bash
#
# Install this repo's git hooks. `.git/hooks` is not version-controlled, so the copies under
# `tools/git-hooks/` are the source of truth and this script makes them effective.
#
#   bash tools/install-hooks.sh
#
# Idempotent, and it refuses to overwrite a hook it did not write — a hook somebody else put there
# is theirs, and silently replacing it is the kind of help nobody asked for.

set -eu
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"

for src in tools/git-hooks/*; do
  name="$(basename "$src")"
  dst=".git/hooks/$name"
  if [ -e "$dst" ] && ! grep -q "tools/git-hooks" "$dst" 2>/dev/null; then
    echo "  ! $name exists and was not installed from here — left alone"
    continue
  fi
  install -m 755 "$src" "$dst"
  echo "  ✓ $name installed"
done

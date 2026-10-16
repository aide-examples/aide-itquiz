#!/usr/bin/env bash
#
# commit-gates.sh — this system's own checks, run by the shared pre-commit hook.
#
# WHY THIS EXISTS (#8). `tools/test-translation.js` documented itself as a guard and was nothing
# of the kind: this repo had no hooks at all, and nothing anywhere referenced the script. It ran
# when somebody typed it, which is to say never — while the entity doc called it „the local
# stand-in" for a referential check the database gives up in exchange for a polymorphic
# reference. A stand-in that never stands.
#
# WHAT BELONGS HERE, and what does not. Only checks over FILES IN THE REPO — seeds, entity docs,
# wordings. A check over live DATA is a system ACTION instead (`Translation.integrity`), because
# the data is not in the commit and a hook has no database worth asking.
#
# The list is not hard-coded: every `tools/test-*.js` runs. A new detector is a file and not an
# edit here, which is the same reason the kind list inside `test-translation.js` became a
# derivation. That glob is THIS repo's convention and stays inside it — the fleet does not share
# it (broadcast names its checks `check-*`, solarmgr has seventeen `test-*` that are not gates).
#
# ── Why this is no longer a hook of its own (2026-10-16) ───────────────────────────────
#
# It was `tools/git-hooks/pre-commit` plus `tools/install-hooks.sh`, written when this repo had
# no gate at all and the framework installed hooks only into itself. The consequence was the one
# that shows up later: this checkout ran ITS detectors and none of the framework's 199, and the
# framework's hook — which has since learned to find its tools from a system checkout — could
# not be installed here without removing this one.
#
# So the parts split by owner. The framework owns the hook and the fleet gates; this file owns
# what is true about itquiz. Installed fleet-wide by `bash tools/install-system-hooks.sh` in the
# framework checkout, which is also what replaced this repo's own installer.
#
# A GATE, not a convenience: a red detector blocks the commit. For a deliberate work-in-progress
# commit, bypass the whole hook with `git commit --no-verify`.

set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO" || exit 0

# No node → skip rather than block. A hook must not brick a checkout that lacks the toolchain.
command -v node >/dev/null 2>&1 || exit 0

shopt -s nullglob
detectors=(tools/test-*.js)
[ ${#detectors[@]} -gt 0 ] || exit 0

red=0
for d in "${detectors[@]}"; do
  if ! out="$(node "$d" 2>&1)"; then
    echo "✗ itquiz gate failed: $(basename "$d" .js)"
    printf '%s\n' "$out" | sed 's/^/    /'
    red=$((red + 1))
  fi
done

[ "$red" -gt 0 ] && exit 1
echo "✓ itquiz: ${#detectors[@]} own detector(s) green"
exit 0

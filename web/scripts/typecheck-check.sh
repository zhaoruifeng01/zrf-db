#!/usr/bin/env sh
# typecheck-check.sh
#
# Compare current tsc errors against .typecheck-baseline.txt.
# Fails only on NEW errors (lines in current but not in baseline).
# Fixed errors (lines in baseline but not in current) are reported as wins
# but do not fail - update the baseline by running `npm run typecheck:baseline`.
#
# See adr/0001-unify-frontend-stack.md for the baseline isolation policy.

set -u

TSC="./node_modules/.bin/tsc"
BASELINE=".typecheck-baseline.txt"
CURRENT=".typecheck-current.txt"

if [ ! -x "$TSC" ] && [ ! -f "$TSC" ]; then
  echo "[typecheck] tsc not found at $TSC" >&2
  exit 2
fi

if [ ! -f "$BASELINE" ]; then
  echo "[typecheck] No baseline at $BASELINE." >&2
  echo "[typecheck] Run 'npm run typecheck:baseline' to capture the current snapshot." >&2
  exit 2
fi

# Run tsc, capture only error lines, sort for stable diff.
# tsc exits non-zero on errors; we tolerate that here.
"$TSC" --noEmit 2>&1 | grep "error TS" | sort > "$CURRENT" || true

BASELINE_COUNT=$(wc -l < "$BASELINE" | tr -d ' ')
CURRENT_COUNT=$(wc -l < "$CURRENT" | tr -d ' ')

# comm -13: lines only in current (i.e. new errors).
NEW_ERRORS=$(comm -13 "$BASELINE" "$CURRENT")
# comm -23: lines only in baseline (i.e. fixed errors).
FIXED_ERRORS=$(comm -23 "$BASELINE" "$CURRENT")

NEW_COUNT=$(printf '%s\n' "$NEW_ERRORS" | grep -c "error TS" || true)
FIXED_COUNT=$(printf '%s\n' "$FIXED_ERRORS" | grep -c "error TS" || true)

echo "[typecheck] baseline=$BASELINE_COUNT current=$CURRENT_COUNT new=$NEW_COUNT fixed=$FIXED_COUNT"

if [ -n "$NEW_ERRORS" ] && [ "$NEW_COUNT" -gt 0 ]; then
  echo "[typecheck] FAIL: new type errors detected:"
  printf '%s\n' "$NEW_ERRORS"
  rm -f "$CURRENT"
  exit 1
fi

if [ "$FIXED_COUNT" -gt 0 ]; then
  echo "[typecheck] $FIXED_COUNT error(s) fixed since baseline. Consider running 'npm run typecheck:baseline' to refresh."
fi

rm -f "$CURRENT"
echo "[typecheck] OK: no new type errors."
exit 0

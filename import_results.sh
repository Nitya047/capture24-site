#!/bin/sh
# Copy the website files out of the modelling notebook's results.zip into data/.
# Usage:  sh import_results.sh ~/Downloads/results.zip
# Only the files the site needs are copied. split.json and cv_results.csv stay out,
# because split.json lists participant IDs.
set -e
ZIP="${1:?give the path to results.zip}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
unzip -q "$ZIP" -d "$TMP"
SRC="$(dirname "$(find "$TMP" -name results.json | head -n 1)")"
[ -f "$SRC/results.json" ] || { echo "results.json not found inside $ZIP"; exit 1; }
mkdir -p "$HERE/data/figures"
for f in results budget leakage learning_curve persons compact; do
  cp "$SRC/$f.json" "$HERE/data/$f.json"
done
[ -d "$SRC/figures" ] && cp "$SRC"/figures/*.png "$HERE/data/figures/" 2>/dev/null || true
if grep -q '"pid"' "$HERE/data/persons.json"; then
  echo "WARNING: persons.json contains participant IDs - do not publish it"; exit 1
fi
rm -rf "$TMP"
echo "Copied into $HERE/data:"; ls "$HERE/data" "$HERE/data/figures"

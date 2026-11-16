#!/bin/sh
# Refresh results/ (everything) and data/ (the website's subset) from the modelling notebook's results.zip.
# Usage:  sh import_results.sh ~/Downloads/results.zip
# data/ never gets split.json or the CSVs, so the website itself shows no participant IDs.
set -e
ZIP="${1:?give the path to results.zip}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
unzip -q "$ZIP" -d "$TMP"
SRC="$(dirname "$(find "$TMP" -name results.json | head -n 1)")"
[ -f "$SRC/results.json" ] || { echo "results.json not found inside $ZIP"; exit 1; }
if grep -q '"pid"' "$SRC/persons.json"; then
  echo "WARNING: persons.json contains participant IDs - not importing"; exit 1
fi
# full results for the repository
mkdir -p "$HERE/results/figures"
cp "$SRC"/*.json "$SRC"/*.csv "$HERE/results/" 2>/dev/null || true
[ -d "$SRC/figures" ] && cp "$SRC"/figures/*.png "$HERE/results/figures/" 2>/dev/null || true
# website subset
mkdir -p "$HERE/data/figures"
for f in results budget leakage learning_curve persons compact; do
  cp "$SRC/$f.json" "$HERE/data/$f.json"
done
[ -d "$SRC/figures" ] && cp "$SRC"/figures/*.png "$HERE/data/figures/" 2>/dev/null || true
rm -rf "$TMP"
echo "Updated $HERE/results and $HERE/data"

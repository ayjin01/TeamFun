#!/bin/zsh
# Runs the tests using the JavaScript engine that ships with macOS (no install needed).
# Usage: zsh tests/run.sh
cd "$(dirname "$0")"
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
failed=0
for file in *.test.mjs; do
  echo "== $file"
  "$JSC" -m "$file" || failed=1
done
exit $failed

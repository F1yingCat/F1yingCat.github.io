#!/usr/bin/env bash
# Put the hand-maintained pages back after Gmeek rewrites docs/.
#
# WHY THIS EXISTS
#   Gmeek's runAll mode regenerates docs/ from its own model (backup/*.md +
#   blogBase.json) and then runs `git add . && git commit` on the result.
#   Every file it knows about gets its own version written over ours, and
#   history proves it: commit 6276c3c (2026-08-27) rewrote
#   docs/MarketViewer.html, docs/assets/render.js and docs/data/*.
#   Those are exactly the files we hand-maintain under static/.
#   Gmeek also has its own deploy job, so the reset used to be PUBLISHED too.
#
#   market-viewer-sync.yml already repairs this afterwards (it triggers on
#   Gmeek's workflow_run), but that leaves a window where the reset is live,
#   and its condition is `workflow_run.conclusion != 'failure'` -- so if Gmeek
#   fails, the repair is skipped too and the reset sticks.
#
#   So this script is called from INSIDE Gmeek.yml, after the docs copy and
#   before its commit + deploy: nothing reset ever reaches git or the site.
#   It is also called from market-viewer-sync.yml, which is the only repair
#   path for the "someone pushed to static/" case.
#
#   Keeping the file list here (one place) is the point: it used to live inline
#   in market-viewer-sync.yml, and adding a second copy in Gmeek.yml would let
#   the two drift -- a page restored by one workflow and clobbered by the other.
#
# ASCII-ONLY comments so it survives any locale.
# Note the explicit `if` blocks: under `set -e`, a bare `[ -f x ] && cp ...`
# exits the script when the test fails, and "not present" is the common case.

set -euo pipefail

restore_file() {
  if [ -f "$1" ]; then
    mkdir -p "$(dirname "$2")"
    cp -f "$1" "$2"
  fi
}

# whole pages
restore_file static/index.html        docs/index.html
restore_file static/tag.html          docs/tag.html
restore_file static/MarketViewer.html docs/MarketViewer.html
restore_file static/rss.xml           docs/rss.xml

# post pages
if [ -d static/post ]; then
  mkdir -p docs/post
  cp -f static/post/*.html docs/post/ 2>/dev/null || true
fi

# assets/ and data/ are directories: merge the contents, never replace the dir
if [ -d static/assets ]; then
  mkdir -p docs/assets
  cp -r static/assets/. docs/assets/
fi
if [ -d static/data ]; then
  mkdir -p docs/data
  cp -r static/data/. docs/data/
fi

# Deliberately NOT restored:
#   static/fonts/  -- unreferenced; the pages inline the font as base64, so
#                     shipping it would only grow the deploy artifact.
#                     market-viewer-sync.yml already excludes it on purpose.
#
# On data/: restoring it from static/ is safe in CI because the checkout and
# static/ are the same tree at that moment. The stale-local-copy hazard is a
# local-only problem, not a CI one.

echo "restore-docs: hand-written pages put back into docs/"

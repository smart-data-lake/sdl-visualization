#!/usr/bin/env bash
# Indexes a statically served (`local;`) project: ./build_index.sh [<state-dir>] [<config-dir>]
set -e
DIR="$(dirname "$0")"

# the repository runs the scripts from source against public/, a release runs them bundled
# (`yarn build:scripts`) against the folder it is served from
if [ -f "$DIR/scripts/buildConfigIndex.ts" ]; then EXT=ts; ROOT="$DIR/public"; else EXT=mjs; ROOT="$DIR"; fi

node "$DIR/scripts/buildConfigIndex.$EXT" --state "${1:-$ROOT/state}" --config "${2:-$ROOT/config}"

# Optional: without it the search falls back to configuration only.
node "$DIR/scripts/buildSearchIndex.$EXT" --public "$ROOT" --env "${SDLB_ENV:-dev}" \
  || echo "search index not built - global search will cover the configuration only"

# Optional: without it tracing a column covers the nodes shown only.
node "$DIR/scripts/buildLineageIndex.$EXT" --schema "$ROOT/schema" \
  || echo "column lineage index not built - tracing a column will cover the nodes shown only"

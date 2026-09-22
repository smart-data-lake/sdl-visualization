#!/usr/bin/env bash

# PYTHON INDEX BUILDER
set -e
python3 -m venv .venv
source "./.venv/bin/activate"
pip3 install -r ./requirements.txt
python3 ./build_index.py $1 $2
deactivate

# SEARCH INDEX (global search). Optional: without it the search falls back to configuration only.
node scripts/buildSearchIndex.ts --public public --env "${SDLB_ENV:-dev}" \
  || echo "search index not built - global search will cover the configuration only"

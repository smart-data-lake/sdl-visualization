#!/usr/bin/env bash

set -e
source "./.venv/bin/activate"
pip3 install -r ./requirements.txt
python3 ./scripts/build_index.py
source deactivate

yarn install
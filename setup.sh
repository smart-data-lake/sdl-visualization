#!/usr/bin/env bash

# PYTHON INDEX BUILDER
set -e
python -m venv .venv
source "./.venv/bin/activate"
pip3 install -r ./requirements.txt
python3 ./scripts/build_index.py
deactivate

# YARN 
yarn install
yarn start
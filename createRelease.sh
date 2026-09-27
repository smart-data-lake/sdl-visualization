#!/bin/bash

yarn build
yarn build:scripts

pushd build

tar -czvf ../sdl-visualizer.tar.gz images/* static/css/*.css static/js/*.js index.html manifest.json sdl_logo192.png lighttpd.conf README.md build_index.sh scripts/*.mjs

popd

#!/bin/bash

yarn build

pushd build

tar -czvf ../sdl-visualizer.tar.gz images/* static/css/*.css static/js/*.js index.html manifest.json sdl_logo192.png lighttpd.conf README.md build_index.sh build_index.py requirements.txt

popd

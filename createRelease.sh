#!/bin/bash

yarn build

pushd build

tar -czvf ../sdl-visualizer.tar.gz static/css/*.css static/js/*.js index.html manifest.json sdl_logo192.png lighttpd.conf

popd

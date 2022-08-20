#!/bin/bash

yarn build

pushd build

tar -czvf ../sdl-vizualizer.tar.gz static/css/*.css static/js/*.js index.html manifest.json sdl_logo192.png

popd

#!/bin/bash

yarn build

pushd build

tar -czvf sdlVizualizer.tar.gz static/css/*.css static/js/*.js index.html manifest.json sdl_logo192.png serve.json

popd
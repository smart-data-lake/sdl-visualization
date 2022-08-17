# Serving on Linux

install small Webserver "serve"
`npm install -g serve`

create symlinks in this directory to the directories where the SDLB projects config and description files are stored, e.g. if they are stored in the parent directory:
`ln -s ../config`
`ln -s ../description`

Start serving by executing the following command in this directory:
`serve`
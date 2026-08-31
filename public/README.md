# Lighttpd

Serve the UI locally using a lighttpd as a small Webserver.

Install "lighttpd":
- `sudo apt install lighttpd`

Adapt lighttpd.conf to your needs. Default setup is to listen on port 5000 for http on all interfaces and serve all files from the current folder.
For production use an https proxy and authentication should be put in front, e.g. oauth2-proxy, and server.bind set to 127.0.0.1.
Choose `lighttpd-parent.conf` configuration do serve config, envConfig, state, stats and description directory from the parent folder, and the rest from this directory.
This allows to have a subdirectory with sdl-visualization release files, serving the SDLB configuration of your project. 

Start serving by executing the following command in the directory of this README file:
- `lighttpd -D -f lighttpd-parent.conf`: For serving project data directories from the parent directory: 
- `lighttpd -D -f lighttpd.conf`: For serving project data directories from the same directory: 

Note: parameter `-D` is to start lighttpd in non-deamonized mode.

Note: this needs to be the build directory, not the 'public' directory of the repository. The 'public' directory is missing build artifacts.
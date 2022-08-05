## Bundle Node scripts into vanilla JS with browserify

The [HOCON-parser](https://github.com/josephtzeng/hocon-parser) used in this project is a node library, which is why it imports external libraries using the 
"require" keyword. In order to integrate the parser as a client functionality, we can use the [browserify](https://browserify.org/)
 library that transpiles node scripts into vanilla JS scripts by recursively bundling and concatenating the node libraries into one 
 vanilla JS file. This file can then be referenced in the index.html page that is served with the application. 

 The main logic for this solution is:
 1. Upload the .conf HOCON files in the public/config folder. 
 2. Merge the wanted .conf files into one include.conf HOCON file using the "include" functionality of [HOCON](https://github.com/lightbend/config/blob/main/HOCON.md). 
 3. Create a node script parseHocon.js that reads this file and parses it into a .js object.
 4. Use browserify to transpile and bundle the parseHocon.js into a budnle.js file. For this, install browserify with
 ```console
npm i browserify 
```
and then use browserify for compiling:
 ```console
browserify parseHocon.js > bundle.js -d. 
```
The -d flag creates a sourceMap in order to debug problems with our code using the original parseHocon.js file. 
5. Reference the compiled file within index.js:
 ```html
<script src='./bundle.js'><script />
```
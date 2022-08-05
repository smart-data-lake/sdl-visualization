const fs = require('fs');

const allFileContents = fs.readFileSync('./example.txt', 'utf-8');

console.log(allFileContents);
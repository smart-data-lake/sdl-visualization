const fs = require('fs');

function parse(pathToFile){
  const allFileContents = fs.readFileSync(pathToFile, 'utf-8');
  let tableParsingActive = false;
  let paragraphs = [];
  let currString = '';
  allFileContents.split(/\r?\n/).forEach(line =>  {
    console.log(line);
      if (line.startsWith('@column')){
          if (!tableParsingActive){
              currString = currString.concat('|Column|Description|', '\n', '|-----|-----|', '\n');
              tableParsingActive = true;
          }
          lineArr = line.split('\`');
          currString = currString.concat('|', lineArr[1], '|', lineArr[2], '|', '\n');
      }
      else{
          tableParsingActive = false;
          currString = currString.concat(line ,'\n');
      }
  });
  fs.writeFile('test.md', currString, (err) => {
    if (err) {
        throw err;
    }
    console.log("Parsing finished");
  });
}

parse('C:\\Users\\SOTI\\Documents\\git_repos\\sdlb_configuration_visualizer_ts\\src\\components\\archiv\\example_data_Object_description.md');


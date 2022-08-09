/**
 * Custom parser for .MD files in SDLB. 
 * The "@column" annotation denotes the start of a table in the .md file. 
 * The "@dataObject" annotation references external data Objects
 * The "@otherColumn" annotation references another column
 * 
 * The (optional) table descriptions and further .md Syntax notations must come BEFORE the tables themselves, so that the structure of the document
 * remains: 
 * Header1, description1, table1, header2, description2, table2, etc...
 **/ 

export default function parseCustomMarkdown(text){
  let tableParsingActive = false;
  let currString = '';
  text.split(/\r?\n/).forEach(line =>  {
    line = line.replace(/\t/g, '');
      if (line.startsWith('@column')){
          if (!tableParsingActive){
              currString = currString.concat('\n', '|Column|Description|', '\n', '|-----|-----|'); //start table
              tableParsingActive = true;
          }
          else{
            currString = currString.concat('|'); //close previous row
          }
          let lineArr = line.split('\`');
          currString = currString.concat('\n', '|', lineArr[1], '|', lineArr[2]);
      }
      else if (line.startsWith('#')){
        if (tableParsingActive){
          currString = currString.concat('|'); //close last row of table
          tableParsingActive = false;
        }
        currString = currString.concat('\n', line);
      }
      else{
        if (!tableParsingActive){
          currString = currString.concat('\n'); //"close" header
        }
          currString = currString.concat(line);
      }
  });
  return currString;
}  
const parse = require ("@pushcorn/hocon-parser");
const fs = require('fs');

function showDataObjects(jsonFile) {
    //console.log(JSON.stringify(jsonFile.actions, null, '\t')) //stringify with tabs for readibility.
    console.log(jsonFile) //stringify with tabs for readibility.
}


function parseHoconToJson(pathToHoconFile){
    const fileNameArr = pathToHoconFile.split(".");
    const jsonName = fileNameArr[fileNameArr.length-2].replace('/', '') + '.json';
    parse ({url: pathToHoconFile, strict: true}).then (jsonObject =>{
        const jsonFile = JSON.stringify(jsonObject, null, '\t');
        fs.writeFile(jsonName, jsonFile, (err) => {
            if (err) {
                throw err;
            }
            console.log("JSON data is saved.");
        });
    }); 
}

function parseHoconToJs(pathToHoconFile){
    const fileNameArr = pathToHoconFile.split(".");
    const jsonName = fileNameArr[fileNameArr.length-2].replace('/', '') + '.js';
    parse ({url: pathToHoconFile, strict: true}).then (jsonObject =>{
        const jsonFile = 'export default ' + JSON.stringify(jsonObject, null, '\t');
        fs.writeFile(jsonName, jsonFile, (err) => {
            if (err) {
                throw err;
            }
            console.log(".js file created");
        });

    }); 
}


//At this point we must hardcode the location of the includes file as it is otherwise not found in the the transpiled version of browserify.
parseHoconToJs('C:\\Users\\SOTI\Documents\\git_repos\\sdlb_configuration_visualizer_ts\\src\\components\\util\\hocon_parser\\includes.conf');

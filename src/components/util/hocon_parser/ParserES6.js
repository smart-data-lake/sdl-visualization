import parse from "@pushcorn/hocon-parser";
//import { writeFile } from 'fs';



export default function parseHoconToJs(pathToHoconFile){
    //const fileNameArr = pathToHoconFile.split(".");
    //const jsonName = fileNameArr[fileNameArr.length-2].replace('/', '') + '.js';
    parse ({url: pathToHoconFile, strict: true}).then (jsonObject =>{
        const jsonFile = 'export default ' + JSON.stringify(jsonObject, null, '\t');
        console.log(jsonFile);
/*         writeFile(jsonName, jsonFile, (err) => {
            if (err) {
                throw err;
            }
            console.log(".js file created");
        });
 */
    }); 
}

//parseHoconToJs('./SBB_ANABEL.conf');

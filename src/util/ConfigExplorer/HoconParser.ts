import {Context} from "@pushcorn/hocon-parser/lib/core/Context";

/**
 * Parse Hocon file from url
 * @param hoconUrl url to read
 * @returns Hocon config object 
 */
async function parseFileStrict(hoconUrl: String): Promise<Object> {
    var context = new Context ({url: hoconUrl, strict: true});
    var registry = context.getRegistry();
    registry['sources']['file'] = registry['sources']['http'];
    var result  = await context.resolve();
    return result;
}

/**
 * Parse Hocon from string
 * @param text to parse
 * @returns Hocon config object 
 */
 async function parseTextStrict(text: String): Promise<Object> {
    var context = new Context ({text: text, strict: true});
    var registry = context.getRegistry();
    registry['sources']['file'] = registry['sources']['http'];
    var result  = await context.resolve();
    return result;
}

/**
 * Flexible parser for json list of files
 * @param json 
 * @returns tuple of files and directories listed in json 
 */
function parseJsonList(text: any): [string[], string[]] {
    const json = JSON.parse(text);
    var availableFiles: string[] = [];
    var availableDirs: string[] = [];
    // response might be an array, but also a more complex object depending on the environment
    if (!json) {
        throw new Error("Response.json empty");
    } else if (Array.isArray(json)) {
        availableFiles = json.filter(f => f.endsWith(".conf"));
        availableDirs = json.filter(f => f.endsWith("/"));
    } else if (Array.isArray(json['files'])) {
        availableFiles = json['files'].map(f => f.base).filter(f => f.endsWith(".conf"));
        availableDirs = json['files'].map(f => f.base).filter(f => f.endsWith("/"));
    } else {
        throw new Error("Not supported response type ", json);
    }
    return [availableFiles, availableDirs];
}

/**
 * Flexible parser for html list of files
 * @param html 
 * @returns tuple of files and directories listed in html 
 */
 function parseHtmlList(html: string): [string[], string[]] {
    var el = document.createElement( 'html' );
    el.innerHTML = html;
    var availableFiles: string[] = [];
    var availableDirs: string[] = [];
    // search for <ul> element with name 'files', or for a <table> element
    var htmlList = Array.from(el.getElementsByTagName("ul")).find(e => e.id === "files" || e.className === "files")
    var htmlTable = el.getElementsByTagName("table").item(0);
    var htmlParent = (htmlList ? htmlList : htmlTable);
    if (htmlParent) {
        const links = htmlParent.getElementsByTagName("a")
        Array.from(links).forEach(link => {
            var entry = link.getAttribute("title");
            if (!entry) entry = link.textContent;
            if (entry) {
                if ((entry.endsWith("/") || link.href.endsWith("/") || Array.from(link.classList).some(c => c.includes("directory"))) && !entry.startsWith("..")) {
                    availableDirs.push(entry);
                } else if (entry.endsWith(".conf")) {
                    availableFiles.push(entry);
                }
            }
        });
    } else throw new Error("No files list found in HTML file listing");
    return [availableFiles, availableDirs];
}

function prefixWithSlash(str: string): string {
    if (str.startsWith("/")) return str;
    return "/" + str;
}

/**
 * List config files recursively by http directory list request
 */
function listConfigFiles(url: string, path: string): Promise<string[]> {
    const files = getUrlContent(url + path)
    .then(text => {
        var files, dirs: string[] = [];
        if (text.startsWith("<")) {
            [files, dirs] = parseHtmlList(text)
        } else {
            [files, dirs] = parseJsonList(text);
        }
        var subDirFiless = [Promise.resolve(files.map(f => path + prefixWithSlash(f)))];
        dirs.forEach(dir => subDirFiless.push(listConfigFiles(url, path + prefixWithSlash(dir))));
        return Promise.all(subDirFiless)
        .then(filess => filess.flat())
    });
    return files;
}

/**
 * Read config files from index.json url
 */
function readConfigIndexFile(baseUrl: string): Promise<string[]> {
    const files = getUrlContent(baseUrl+"/index.json")
    .then(text => {
        const [files, dirs] = parseJsonList(text);
        if (dirs.length > 0) console.log("Directories in index.json are ignored");
        return files;
    });
    return files;
}

/**
 * Read additional config from manifest.json url
 */
function readManifestFile(baseUrl: string): Promise<any> {
    const files = getUrlContent(baseUrl+"/manifest.json")
    .then(text => JSON.parse(text));
    return files;
}

/**
 * Return URL content, throw error if index.html is returned (redirect) or an other error happens.
 */
function getUrlContent(url: string): Promise<string> {
    return fetch(url).then(response => {
        if (!response.ok) throw new Error("Could not read "+url+": Response "+response.status+" "+response.statusText+" "+response.body);
        return response.text().then(t => {
            if (t.startsWith("<!DOCTYPE html>\n<html lang")) throw new Error("Could not read "+url+" because it does not exists (rerouted to index.html)");
            return t;
        })
    });
}

/**
 * Standardizes recursively all object keys from KebabCase (hyphen separated) to CamelCase, 
 * as SDLB accepts both syntax for configuration properties, and we should do the same in the visualizer.
 */
function standardizeKeys(input: any, parentKey?: string): any {
    if (typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(x => standardizeKeys(x, parentKey));
    if (Object.keys(input).length === 0) return;
    return Object.keys(input).reduce(function (newObj: any, key: string) {
        let val = input[key];
        let newVal = (typeof val === 'object') && val !== null ? standardizeKeys(val, key) : val;
        if (newVal) {
            if (parentKey==="connections" || parentKey==="dataObjects" || parentKey==="actions" || parentKey==="options" || parentKey==="runtimeOptions" || parentKey==="sparkOptions") newObj[key] = newVal;
            else newObj[kebabToCamelCase(key)] = newVal;
        }
        return newObj;
    }, {});
};

function kebabToCamelCase(input: string): string {
    return input.replace(/-./g, x=>x[1].toUpperCase());
}

export {parseFileStrict, parseTextStrict, listConfigFiles, readConfigIndexFile, readManifestFile, getUrlContent, standardizeKeys};
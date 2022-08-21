const {Context} = require ("@pushcorn/hocon-parser/lib/core/Context");

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

/**
 * List config files recursively by http directory list request
 */
function listConfigFiles(url: string, path: string): Promise<string[]> {
    const files = fetch(url + path)
    .then(response => {
        if (response.ok) return response.text();
        else throw new Error("Response "+response.status+" "+response.statusText+" "+response.body);
    })
    .then(text => {
        var files, dirs: string[] = [];
        if (text.startsWith("<")) {
            [files, dirs] = parseHtmlList(text)
        } else {
            [files, dirs] = parseJsonList(text);
        }
        var subDirFiless = [Promise.resolve(files.map(f => path + f))];
        dirs.forEach(dir => subDirFiless.push(listConfigFiles(url, path + dir + "/")));
        return Promise.all(subDirFiless)
        .then(filess => filess.flat())
    });
    return files;
}

/**
 * Read config files from index.json url
 */
function readConfigIndexFile(url: string): Promise<string[]> {
    const files = fetch(url+"index.json")
    .then(response => {
        if (response.ok) return response.text();
        else throw new Error("Response "+response.status+" "+response.statusText+" "+response.body);
    })
    .then(text => {
        const [files, dirs] = parseJsonList(text);
        if (dirs.length > 0) console.log("Directories in index.json are ignored");
        return files;
    });
    return files;
}


export {parseFileStrict, parseTextStrict, listConfigFiles, readConfigIndexFile};
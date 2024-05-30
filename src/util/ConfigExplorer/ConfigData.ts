import { getPropertyByPath, isArray, onlyUnique } from "../helpers";
import { DAGraph, DataObjectsAndActionsSep } from "./Graphs";

export class ConfigData {
    public dataObjects = {};
    public actions = {};
    public connections = {};
    public global = {};
    // TODO: can we create an empty DataObjectsAndActionsSep?
    public fullGraph: DAGraph | undefined = undefined;
    public dataGraph: DAGraph | undefined = undefined;
    public actionGraph: DAGraph | undefined = undefined;

    constructor(data: any) {
        if (data.dataObjects && typeof data.dataObjects === 'object') {
            this.dataObjects = data.dataObjects;
        }
        if (data.actions && typeof data.actions === 'object') {
            this.actions = data.actions;
        }
        if (data.connections && typeof data.connections === 'object') {
            this.connections = data.connections;
        }  
        if (data.global && typeof data.global === 'object') {
            this.global = data.global;
        }
        this.fullGraph = new DataObjectsAndActionsSep(this);
        this.dataGraph = this.fullGraph?.getDataGraph();
        this.actionGraph = this.fullGraph?.getActionGraph();     
    }    
}

/**
 * ConfigDataLists hold sorted lists of all DataObjects, Actions and Connections. Then it allows to apply filters
 * and keep the selected lists for the UI.
 */
export class InitialConfigDataLists implements ConfigDataLists {
    public dataObjects: any[] = [];
    public actions: any[] = [];
    public connections: any[] = [];
    private initialData: ConfigData | undefined;

    constructor(data?: ConfigData) {
        this.initialData = data;
        if (data) {
            this.dataObjects = this.getSortedEntries(data.dataObjects);
            this.actions = this.getSortedEntries(data.actions);
            this.connections = this.getSortedEntries(data.connections);
        }
    }

    private getSortedEntries(obj: object): any[] {
        return Object.entries(obj)
        .map(([k,v]) => {v.id = k; return v}) // add key as id
        .sort((a,b) => this.sortString(a.id, b.id)); // sort by id
    }
    private sortString(a: string, b: string) {
        if (a === b) return 0;
        if (a < b) return -1;
        else return 1;
    }

    public applyContainsFilter(prop: string, str: string): ConfigDataLists {
        if (str) {
            const propClean = prop.trim();
            const strLower = str.trim().toLowerCase();
            const filterDef = (obj:any) => {
                const v = getPropertyByPath(obj,propClean);
                return (v && v.toLowerCase().includes(strLower));
            }
            return this.applyFilterFunc(filterDef);
        }
        // default return all
        return this;
    }

    public applyRegexFilter(prop: string, regex: string): ConfigDataLists {
        if (prop) {
            const filterDef = this.getRegexFilterFunc(prop, regex);
            return this.applyFilterFunc(filterDef);
        }
        // default return all
        return this;
    }
    private getRegexFilterFunc(prop: string, regex: string, anchored: boolean = false) {
        const propClean = prop.trim();
        let regexObj = /.*/;
        try {
            regexObj = (anchored ? new RegExp("^"+regex.trim()+"$") : new RegExp(regex.trim()));
        } catch {
            if (regex) throw new Error(`regular expression "${regex}" not valid`);
        }
        return (obj:any) => {
            const v = getPropertyByPath(obj,propClean);
            return (v && (
                (typeof v !== 'object' && v.match(regexObj)) ||
                (isArray(v) && v.some(e => e.match(regexObj)))
            ));
        }        
    }

    

    /*
     * Filter action list with extended syntax: "<prefix:?><regex>,<operation?><prefix:?><regex>;...".
     * See Apputil.filterActionList in scala project for details.
     * 
     * After the actions are selected, all directly involved dataObjects and connections are selected as well.
     * 
     * Note that not yet all prefixes are implmeneted, e.g. startFromActionIds, endWithActionIds, startFromDataObjectIDs and endWithDataObjectIds are missing.
     * An error is thrown if they are used.
     */
    public applyFeedFilter(feedSel: string): ConfigDataLists {
        if (feedSel) {
            const patterns = feedSel.toLowerCase().split(',');
            const opMatcher = /([|&-])?(.*)/;
            const prefixMatcher = /([a-z]+:)?(.*)/;
            const emptyResult: string[] = []
            const actionIds = patterns.reduce((result, patternWithOp) => {
                var newResult: string[] = result;
                const opMatch = patternWithOp.trim().match(opMatcher);
                if (opMatch) {
                    const op = opMatch[1];
                    const pattern = opMatch[2];
                    const prefixMatch = pattern.trim().match(prefixMatcher);
                    if (prefixMatch) {
                        const prefix = prefixMatch[1];
                        const regex = prefixMatch[2];
                        const selectedActionIds = this.filterActionsByCustomizedRegex(prefix, regex).map(a => a.id);
                        switch(op) {
                            // union
                            case undefined: // default
                            case '|': 
                                selectedActionIds.forEach(a => {
                                    if (!newResult.includes(a)) newResult.push(a);
                                }); 
                                break;
                            // intersection
                            case '&': 
                                newResult = result.filter(a => selectedActionIds.includes(a)); 
                                break;
                            // diff
                            case '-': 
                                newResult = result.filter(a => !selectedActionIds.includes(a)); 
                                break;
                            default: throw new Error(`Unknown operation ${op} for pattern ${pattern}`)
                        }                                                
                    } else {
                        throw Error(`'${pattern}' did not match pattern '<prefix:?><regex>'`);
                    }
                } else {
                    throw Error(`'${patternWithOp}' did not match pattern '<operation?><prefix:?><regex>'`);
                }
                return newResult;
            }, emptyResult)
            // apply selected action ids to dataObjects and connections
            if (this.initialData) {
                // prepare selected actions
                const selectedActions: any[] = [];
                actionIds.forEach(id => selectedActions.push(this.initialData!.actions[id]));
                // gather involved data objects
                const selectedDataObjects: any[] = [];
                selectedActions.forEach(a => {
                    if (a.inputId) selectedDataObjects.push(this.initialData!.dataObjects[a.inputId]);
                    if (a.inputIds) a.inputIds.forEach(id => selectedDataObjects.push(this.initialData!.dataObjects[id]));
                    if (a.outputId) selectedDataObjects.push(this.initialData!.dataObjects[a.outputId]);
                    if (a.outputIds) a.outputIds.forEach(id => selectedDataObjects.push(this.initialData!.dataObjects[id]));
                });
                // gather involved connections
                const selectedConnections: any[] = [];
                selectedDataObjects.forEach(a => {
                    if (a.connectionId) selectedConnections.push(this.initialData!.dataObjects[a.connectionId]);
                });
                return {actions: selectedActions, dataObjects: selectedDataObjects.filter(onlyUnique), connections: selectedConnections.filter(onlyUnique)};
            }
        }
        // default return all
        return this;        
    }
    private filterActionsByCustomizedRegex(tpe: string, regex: string) {
        switch (tpe) {
            case undefined: // default is filter feeds
            case "feeds:": return this.actions.filter(this.getRegexFilterFunc('metadata.feed', regex, true));
            case "names:": return this.actions.filter(this.getRegexFilterFunc('metadata.name', regex, true));
            case "ids:": return this.actions.filter(this.getRegexFilterFunc('id', regex, true));
            case "layers:": return this.actions.filter(this.getRegexFilterFunc('metadata.layer', regex, true));
            case "startfromactionids:": throw new Error(`Prefix ${tpe} is not yet implemented`);
            case "endwithactionids:": throw new Error(`Prefix ${tpe} is not yet implemented`);
            case "startfromdataobjectids:": throw new Error(`Prefix ${tpe} is not yet implemented`);
            case "endwithdataobjectids:": throw new Error(`Prefix ${tpe} is not yet implemented`);
            default: throw new Error(`Unknown prefix ${tpe} for regex ${regex}`);
        }
    }
    
    private applyFilterFunc(filterFunc: (any) => boolean): ConfigDataLists {
        return {
            dataObjects:this.dataObjects.filter(filterFunc),
            actions: this.actions.filter(filterFunc),
            connections: this.connections.filter(filterFunc)
        }
    }

    public isEmpty() {
        return (this.dataObjects.length === 0 && this.actions.length === 0 && this.connections.length === 0);
    }
}

export interface ConfigDataLists {
    dataObjects: any[];
    actions: any[];
    connections: any[];
}

export const emptyConfigDataLists = new InitialConfigDataLists();

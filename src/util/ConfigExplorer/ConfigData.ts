import { getPropertyByPath } from "../helpers";

export class ConfigData {
    public dataObjects = {};
    public actions = {};
    public connections = {};
    public global = {};

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

    constructor(data?: ConfigData) {
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

    public applyContainsFilter(prop: string, str: string) {
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

    public applyRegexFilter(prop: string, regex: string) {
        if (prop) {
            const propClean = prop.trim();
            const regexObj = (regex ? new RegExp(regex.trim()) : /.*/);
            const filterDef = (obj:any) => {
                const v = getPropertyByPath(obj,propClean);
                return (v && typeof v !== 'object' && v.toString().match(regexObj));
            }
            return this.applyFilterFunc(filterDef);
        }
        // default return all
        return this;
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
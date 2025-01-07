import { Node, Edge, PartialDataObjectsAndActions, NodeType, ActionObject, DataObject } from '../ConfigExplorer/Graphs'

export class Lineage {
    lineageData: any;
    graph: PartialDataObjectsAndActions;

    constructor(data: {action: string, inputIds: string[], outputIds: string[]}[]) {
        let nodes = new Map<string,Node>();
        let edges: Edge[] = [];

        let actions = data.map(entry => {
            const fromNodes = entry.inputIds.map(dataObjectId => {
                if (!nodes.has(dataObjectId)) nodes.set(dataObjectId, new DataObject(dataObjectId));
                return nodes.get(dataObjectId)!;
            });
            const toNodes = entry.outputIds.map(dataObjectId => {
                if (!nodes.has(dataObjectId)) nodes.set(dataObjectId, new DataObject(dataObjectId));
                return nodes.get(dataObjectId)!;
            });
            const actionNode = new ActionObject(fromNodes, toNodes, entry.action);
            nodes.set(entry.action, actionNode);
            return actionNode;
        });                
        actions.forEach(action => {
            action.fromNodes.forEach(fromNode => edges.push(new Edge(fromNode, action, fromNode.id+"-"+action.id)))
            action.toNodes.forEach(toNode => edges.push(new Edge(action, toNode, action.id+"-"+toNode.id)))
        })

        this.graph = new PartialDataObjectsAndActions(Array.from(nodes.values()), edges);
    }

}
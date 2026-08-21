import { Action } from '../../types'
import { DAGraph, Node, Edge, PartialDataObjectsAndActions, NodeType, ActionObject, DataObject } from '../ConfigExplorer/Graphs'
import { FlowMetric, getInputMetric, getOutputMetric } from './metrics'

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

/** The metrics of the data flow an edge of the action graph stands for */
export interface EdgeMetrics {
    /** what the source action wrote to the data object */
    output?: FlowMetric;
    /** what the target action read from the data object */
    input?: FlowMetric;
}

/** The metrics of an action that have no edge to sit on, see getRunMetrics */
export interface NodeMetrics {
    outputs: FlowMetric[];
    inputs: FlowMetric[];
}

/**
 * The metrics to show on the action graph of an attempt.
 *
 * Every edge of the action graph stands for one data object, so it carries two metrics: what the
 * source action wrote to that data object and what the target action read from it. A data object
 * that is written but never read, or read from a source no action of the attempt produced, has no
 * edge - those metrics are returned per action node instead, to be shown next to the node.
 *
 * The action graph has no self edges, so a data object an action reads and writes - the
 * historization pattern - counts as uncovered on both sides unless another action reads or writes
 * it too.
 */
export function getRunMetrics(graph: DAGraph, actions: Map<string, Action>):
    { edgeMetrics: Map<string, EdgeMetrics>, nodeMetrics: Map<string, NodeMetrics> } {

    const edgeMetrics = new Map<string, EdgeMetrics>();
    graph.edges.forEach(edge => {
        if (!edge.dataObjectId) return;
        const output = getOutputMetric(actions.get(edge.source), edge.dataObjectId);
        const input = getInputMetric(actions.get(edge.target), edge.dataObjectId);
        if (output || input) edgeMetrics.set(edge.id as string, {output, input});
    })

    const nodeMetrics = new Map<string, NodeMetrics>();
    graph.nodes.forEach(node => {
        const action = actions.get(node.id as string);
        if (!action) return;
        const [, outEdges] = graph.getOutElems(node.id);
        const [, inEdges] = graph.getInElems(node.id);
        const written = new Set(outEdges.map(edge => edge.dataObjectId));
        const read = new Set(inEdges.map(edge => edge.dataObjectId));
        const outputs = (action.outputIds || []).filter(id => !written.has(id))
            .map(id => getOutputMetric(action, id)).filter(metric => metric !== undefined) as FlowMetric[];
        const inputs = (action.inputIds || []).filter(id => !read.has(id))
            .map(id => getInputMetric(action, id)).filter(metric => metric !== undefined) as FlowMetric[];
        if (outputs.length > 0 || inputs.length > 0) nodeMetrics.set(node.id as string, {outputs, inputs});
    })

    return {edgeMetrics, nodeMetrics};
}

import { Node, Edge, DAGraph, PartialDataObjectsAndActions } from '../ConfigExplorer/Graphs'

export class Lineage {
    lineageData: any;
    graph: DAGraph;

    constructor(data: {action: string, inputIds: string[], outputIds: string[]}[]) {
        const preprocessedData: {id: string, node: Node, edges: {id: string, to: Node}[]}[] = this.prepareGraphData(data)
        const nodes = this.getNodes(preprocessedData);
        const edges = this.getEdges(preprocessedData);

        this.graph = new PartialDataObjectsAndActions(nodes, edges)
    }

    getNodes = (data: {id: string, node: Node, edges: {id: string, to: Node}[]}[]) => {
        let nodes : Node[] = [];
        data.forEach(node => {
            nodes.push(node.node)
        })

        return nodes;
    }

    getEdges = (data: {id: string, node: Node, edges: {id: string, to: Node}[]}[]) => {
        let edges : Edge[] = [];
        data.forEach(fromNode => {
            fromNode.edges.forEach(toNode => {
                edges.push(new Edge(fromNode.node, toNode.to, toNode.id, 'runLineage'))
            })
        })
        
        return edges
    }

    prepareGraphData = (data: {action: string, inputIds: string[], outputIds: string[]}[]) => {
        let nodes: string[] = [];
        let graph: {id: string, node: Node, edges: {id: string, to: Node}[]}[] = [];

        data.forEach(action => {
            action.inputIds.forEach(elem => {
                if (!nodes.includes(elem)) nodes.push(elem);
            });
            action.outputIds.forEach(elem => {
                if (!nodes.includes(elem)) nodes.push(elem);
            });
        });

        nodes.forEach(node => {
            graph.push({id: node, node: new Node(node, {y: 0, x: 0}), edges: []})
        })

        nodes.forEach(node => {
            data.forEach(action => {
                action.inputIds.forEach(input => {
                    if (input === node) {
                        action.outputIds.forEach(target => {
                            graph.forEach(elem => {
                                if (elem.id === node) {
                                    elem.edges.push({to: new Node(target), id: action.action})
                                }
                            })
                        });
                    }
                })
            })
        })

        return graph
    }
}
import { Node, Edge, DAGraph } from '../ConfigExplorer/Graphs'

export class Lineage {
    lineageData: any;
    graph: DAGraph;

    constructor(data: {action: string, inputIds: {id: string}[], outputIds: {id: string}[]}[]) {
        const preprocessedData: {id: string, node: Node, edges: {id: string, to: Node}[]}[] = this.prepareGraphData(data)
        this.graph = new DAGraph(this.getNodes(preprocessedData), this.getEdges(preprocessedData))
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
                edges.push(new Edge(fromNode.node, toNode.to, fromNode.id))
            })
        })

        return edges
    }

    prepareGraphData = (data: {action: string, inputIds: {id: string}[], outputIds: {id: string}[]}[]) => {
        let nodes: string[] = [];
        let graph: {id: string, node: Node, edges: {id: string, to: Node}[]}[] = [];

        data.forEach(action => {
            action.inputIds.forEach(elem => {
                if (!nodes.includes(elem.id)) nodes.push(elem.id);
            });
            action.outputIds.forEach(elem => {
                if (!nodes.includes(elem.id)) nodes.push(elem.id);
            });
        });

        let py = 0;
        nodes.forEach(node => {
            graph.push({id: node, node: new Node(node, {y: py, x: 0}), edges: []})
            py = py+50
        })

        nodes.forEach(node => {
            data.forEach(action => {
                action.inputIds.forEach(input => {
                    if (input.id === node) {
                        action.outputIds.forEach(target => {
                            graph.forEach(elem => {
                                if (elem.id === node) {
                                    elem.edges.push({to: new Node(target.id), id: action.action})
                                }
                            })
                        });
                    }
                })
            })
        })

        console.log(graph)
        return graph
    }
}
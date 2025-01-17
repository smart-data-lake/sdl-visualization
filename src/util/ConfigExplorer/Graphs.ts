/*
    A general Graph structure that is used by React components
*/
import dagre from 'dagre';
import { ConfigData } from './ConfigData';
import assert from 'assert';

import {Node as ReactFlowNode, Edge as ReactFlowEdge, ReactFlowInstance} from 'reactflow'
import store from '../../app/store';
import { getRFI, setRFINodeData } from './slice/LineageTab/Common/ReactFlowSlice';



//Union of two sets
function union<T>(setA: Set<T>, setB: Set<T>) {
    const _union = new Set(setA);
    for (const elem of setB) {
      _union.add(elem);
    }
    return _union;
}

//transform Set to Array
function setAsArray<T>(set: Set<T>){
    var arr: T[] = [];
    set.forEach(elem => {
        arr.push(elem);
    })
    return arr;
}

type id = string

type position = {
    x: number,
    y: number,
}

export const enum NodeType { // could be replaced by polymorphism
    DataNode, 
    ActionNode, 
    CommonNode,
}

export class Node {
    public id: id;
    public position: position;
    public width: number;
    public height: number;
    public level: number;
    public backgroundColor: string;
    public isCenterNode: boolean;
    public data: {id: string};
    public nodeType: NodeType;

    constructor(id: id, 
                nodeType?: NodeType, 
                position?: {x: number, y: number}, 
                level: number = -1){
        this.id = id;
        this.level = level //level defines the longest path starting from all input nodes
        this.position = position ? position : {x:0, y:0};
        this.width = 172;
        this.height = 36;
        this.backgroundColor = '#FFFFFF';
        this.isCenterNode = false;
        this.data = {id: this.id}
        this.nodeType = (nodeType !== undefined) ? nodeType : NodeType.CommonNode;
    }

    setId(newid: string){
        this.id = newid;
    }

    setIsCenterNode(isCenter: boolean){
        this.isCenterNode = isCenter;
    }
} 

// TODO: can be simplified in future versions, does not have to store that many attirbutes
export class Edge {
    public fromNode: Node;
    public toNode: Node;
    public id: id;
    public isCentral: boolean;
    public source: string;
    public target: string;
    public type?: string;

    constructor(fromNode: Node, toNode: Node, id: id, type?: string){
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.id = id; //Ids are not unique identifiers, since we can have the same Edge/Action connecting several Nodes/DataObjects.
        this.isCentral = false;
        this.source = this.fromNode.id;
        this.target = this.toNode.id;
        this.type = type;
    }
}

/*
    A newer implementation of the Graph structure that is used by the Lineage Grpph
    Both DataObjects and Actions will be represented as Nodes 
*/
export class ActionObject extends Node {
    public jsonObject?: any;
    public fromNodes: Node[];
    public toNodes: Node[];

    constructor(fromNodes: Node[], toNodes: Node[], id: id, jsonObject?: any){
        super(id, NodeType.ActionNode);
        this.jsonObject = jsonObject;
        this.fromNodes = fromNodes;
        this.toNodes = toNodes;
    }

    getActionType(): string {
        if (this.jsonObject){
            return this.jsonObject.type;
        } else {
            //console.warn('Cannot read action type, ActionObject does not have a jsonObject. Returning AnyType');
            return 'AnyType';
        }
    }
}

/*
    DataObjects and Actions are represented as vertices and edges respectively in the Lineage Graph
    These implementations will be deprecated in future versions since we will implement actions as
    vertices as well so that the layout can be done automatically.
*/
export class DataObject extends Node { // does the same as getDataObjects 
    public jsonObject?: any;

    constructor(id: id, jsonObject?: any){
        super(id, NodeType.DataNode);
        this.jsonObject = jsonObject;
    }
}

export class Action extends Edge {
    public jsonObject: any;

    constructor(fromNode: Node, toNode: Node, id: id, jsonObject: any){
        super(fromNode, toNode, id);
        this.jsonObject = jsonObject;
    }
}

export class DAGraph { 
    public nodes: Node[];
    public edges: Edge[];
    public levels: number[];
    public sourceNodes: Node[];
    public sinkNodes: Node[];
    public centerNodeId: string = '';

    constructor(nodes: Node[], edges: Edge[]){
        this.nodes = nodes; 
        this.edges = edges;
        this.levels = [];

        this.sourceNodes = this.#computeSourceNodes();
        this.sinkNodes = this.#computeSinkNodes();
    }

    /*
        Compute the list of nodes without incomming edges.
        If the graph is an ActionGraph, the nodes will be actionNodes, otherwise they will be dataNodes
    */
    #computeSourceNodes(){
        return this.nodes.filter(n => this.edges.filter(e => e.toNode === n).length === 0);
    }

    /*
        Compuers the list of nodes without outgoing edges
        We do this by filtering the nodes from the edges, as a node might contain a dest and a src node list
    */
    #computeSinkNodes(){
        return this.nodes.filter(n => this.edges.filter(e => e.fromNode === n).length === 0);
    }

    getSourceNodes(){
        if (!this.sourceNodes) throw new Error("The source nodes have not been computed yet");
        return this.sourceNodes;
    }

    getSinkNodes(){
        if (!this.sinkNodes) throw new Error("The sink nodes have not been computed yet");
        return this.sinkNodes;
    }

    getDirectDescendants(node: Node, returnType: 'node' | 'edge' | 'all'){
        // sanitize inputs
        assert(['node', 'edge', 'all'].includes(returnType), `invalid value for dfs return type: ${returnType}`)
        assert(node !== undefined, "Cannot perform DFS on an undefined node");
        if (returnType === 'node' || returnType === 'edge'){
            return this.#dfs(node, 'forward', returnType);
        } else {
            return this.#dfsAll(node, 'forward');
        }
    }

    getDirectAncestors(node: Node, returnType: 'node' | 'edge' | 'all'){
        // sanitize inputs
        assert(['node', 'edge', 'all'].includes(returnType), `invalid value for dfs return type: ${returnType}`)
        assert(node !== undefined, "Cannot perform DFS on an undefined node");

        if (returnType === 'node' || returnType === 'edge'){
            return this.#dfs(node, 'backward', returnType);
        } else {
            return this.#dfsAll(node, 'backward');
        }
    }

    /*
        Returns an array of reachable nodes or edges from/to a given node in depth-first search order 
        Excluding the starting node
    */
    #dfs(node: Node, direction: 'forward' | 'backward', returnType: 'node' | 'edge'): Node[] | Edge[] {

        const visit = (startNode: Node, visited: Map<string, Node | Edge>) =>  {
            if (!visited.has(startNode.id)){
                var outEdges: Edge[];
                if (returnType === 'node') {visited.set(node.id, startNode);}
                visited.set(startNode.id, startNode);
                if(direction === 'forward'){
                    outEdges = this.edges.filter(edge => edge.fromNode.id === startNode.id);
                    outEdges.forEach(edge => {if (returnType === 'edge'){visited.set(edge.id, edge)}; visit(edge.toNode, visited)});
                } else {
                    outEdges = this.edges.filter(edge => edge.toNode.id === startNode.id);
                    outEdges.forEach(edge => {if (returnType === 'edge'){visited.set(edge.id, edge)}; visit(edge.fromNode, visited)});
                }  
            }
        }
        const visited = new Map();
        visit(node, visited);
        if(returnType === 'node'){ visited.delete(node.id);}
        return Array.from(visited.values());
    }


    /*
        Returns an array of nodes and an array of edges, that are reachable from/to a given node in depth-first search order 
        Excluding the starting node
    */
    #dfsAll(node: Node, direction: 'forward' | 'backward'): [Node[], Edge[]]{
        // sanitize input
        assert(['forward', 'backward'].includes(direction), `invalid value for dfs direction: ${direction}`);

        const visit = (startNode: Node, visitedNodes: Map<string, Node>, visitedEdges: Map<string, Edge>) =>  {
            if (!visitedNodes.has(startNode.id)){
                visitedNodes.set(startNode.id, startNode);
                const  neighbourEdges = direction === 'forward' ? this.edges.filter(edge => edge.fromNode.id === startNode.id)
                                                                : this.edges.filter(edge => edge.toNode.id === startNode.id);
                neighbourEdges.forEach(edge => {visitedEdges.set(edge.id, edge)});
                neighbourEdges.forEach(edge => direction === 'forward' ? visit(edge.toNode, visitedNodes, visitedEdges)
                                                                        : visit(edge.fromNode, visitedNodes, visitedEdges));
            }
        }
        const visitedNodes: Map<string, Node> = new Map();
        const visitedEdges: Map<string, Edge> = new Map();
        visit(node, visitedNodes, visitedEdges);
        visitedNodes.delete(node.id);
        return [Array.from(visitedNodes.values()), Array.from(visitedEdges.values())]
    }



    /*
        gets e1 from e2 in D -> e1 -> A -> e2 -> D' 
        this is only used in the unmerged graph
    */
    #getEdgePredecessor(edge: Edge){
        const e1 = this.edges.filter(e => e.toNode === edge.fromNode)
        return e1[0]; // assume only one input node here
    }

    /*
        returns the directly reachable action objects from an ActionObject a
        called when constructing the action graph

        we have the following invariant:
        type(succ(a)) = DataObject[] and type(succ(succ(a))) = ActionObject[]
    */
    #getDirectlyReachableActionSuccessors(a: ActionObject){
        const succ: ActionObject[] = [];
        
        a.toNodes.forEach(d => {
            const nextActions = this.edges.filter(e => e.fromNode == d);
            nextActions.forEach(action => {
                succ.push(action.toNode as ActionObject);
            })
        });
        return succ;
    }

    setNodes(newNodes: Node[]){
        this.nodes = newNodes;
    }

    setEdges(newEdges: Edge[]){
        this.edges = newEdges;
    } 

    setCenterNode(node: Node){
        this.centerNodeId = node.id;
        node.setIsCenterNode(true);
    }

    setLayout(layout: string){
        if(['TB', 'LR'].includes(layout)){
            const nodesWithPos = dagreLayout(this.nodes, this.edges, layout) as Node[];
            this.setNodes(nodesWithPos);
        } else {
            console.log(`"layout ${layout} is not supported. Please use 'TB' or 'LR'`);
        }
    }

    getNodeById(identifier: string){
        return this.nodes.find(node => node.id === identifier);
    }

    getEdgeById(identifier: string){
        return this.edges.find(edge => edge.id === identifier);
    }

    /** 
        Returns a new graph with dataObject as nodes.

        Caveat: this assumes that we are in a full graph view
    */
    getDataGraph(): DAGraph {
        const newEdges = new Map<string, Edge>();
        const newNodes = this.nodes.filter(node => node.nodeType === NodeType.DataNode);
        
        const actionNodes = this.nodes.filter(node => node.nodeType === NodeType.ActionNode);
        actionNodes.forEach(a => {
            const inEdges = this.edges.filter(ie => ie.toNode.id === a.id);
            const outEdges = this.edges.filter(oe => oe.fromNode.id === a.id);

            inEdges.forEach(ie => {
                outEdges.forEach(oe =>{
                const connection = `${ie.fromNode.id}->${oe.toNode.id}`;
                    if(!newEdges.has(connection)){
                        newEdges.set(connection, new Edge(ie.fromNode, oe.toNode, `${ie.fromNode.id}->${a.id}->${oe.toNode.id}`));
                    }
                })
            })
           
        });
        return new DAGraph(newNodes, [...newEdges.values()]);
    }
    
    /**
     * Returns a new graph with ActionObject as ndoes. The edges are built by connecting neighbouring actions.
     *  In rare case, an action object can have multiple incoming and outgoing edges

        Caveat: this assumes that we are in full graph view
     */

    getActionGraph(): DAGraph {
        // merge n-ary action functions, e.g. if D1 -> A and D2 -> A, then merge D1 and D2 into a single action node 
        // while it could be the case that the out degree of the action node is > 1, we can merge by only looking
        // at the in-degree of the action node 
        const actions = this.nodes.filter(node => node.nodeType === NodeType.ActionNode) as ActionObject[];
        const newNodes: Node[] = actions;
        const newEdges: Edge[] = [];
      
        actions.forEach(action => {
            const actionType = action.getActionType();
            const directlyReachableActions = this.#getDirectlyReachableActionSuccessors(action);
            directlyReachableActions.forEach(toAction =>{
                newEdges.push(new Edge(action, toAction, `${action.id}->${toAction.id}`, actionType));
            }) 
        });

        return new DAGraph(newNodes, newEdges);
    }

    //Returns the nodes and edges of a partial graph based on a specific node (predecessors and succesors) as a pair
    // TODO: can be oimplemented using getOu/In elements since we have the nodes and edges merged when the graph is created now.
    returnPartialGraphInputs(specificNodeId:id): [Node[], Edge[]]{
        function predecessors(nodeId: id, graph: DAGraph){
            var nodes = new Set<Node>();
            var edges = new Set<Edge>();
            graph.edges.forEach(edge => {
                if (edge.toNode.id === nodeId){
                    let pred = predecessors(edge.fromNode.id, graph);
                    nodes.add(edge.fromNode);
                    nodes = union(nodes, pred[0] as Set<Node>);
                    edges.add(edge);
                    edges = union(edges, pred[1] as Set<Edge>);
                }
            });
            return [nodes, edges];
        } 

        function successors(nodeId: id, graph:DAGraph){
            var nodes = new Set<Node>();
            var edges = new Set<Edge>();
            graph.edges.forEach(edge =>{
                if (edge.fromNode.id === nodeId){
                    let succ = successors(edge.toNode.id, graph);
                    nodes.add(edge.toNode);
                    nodes = union(nodes, succ[0] as Set<Node>);
                    edges.add(edge);
                    edges = union(edges, succ[1] as Set<Edge>);
                }
            });
            return [nodes, edges];
        }

        const specificNode = this.nodes.find(node => node.id===specificNodeId) as Node; // this will fail if we rename action nodes as names comre from props, directly read from data
        this.setCenterNode(specificNode);
        const nodes = setAsArray(union(predecessors(specificNodeId, this)[0] as Set<Node>, 
                                 successors(specificNodeId, this)[0] as Set<Node>));//merge predeccessors and successors     
        nodes.push(specificNode as Node); //add the central/origin node itself
        const edges = setAsArray(union(predecessors(specificNodeId, this)[1] as Set<Edge>, 
                                 successors(specificNodeId, this)[1] as Set<Edge>));   

        return [nodes, edges];
    }

    // not used in LineageTab
    returnPartialGraphInputsFromEdge(specificEdgeId: id){
        let edgesWithId = this.edges.filter(edge => edge.id === specificEdgeId);
        let result: [Node[], Edge[]] = [[], []];
        for (let i = 0 ; i < edgesWithId.length ; i++){
            let [nodesNext, edgesNext] = this.returnPartialGraphInputs(edgesWithId[i].toNode.id);
            result = [setAsArray(union(new Set(result[0]), new Set(nodesNext))), setAsArray(union(new Set(result[1]), new Set(edgesNext)))]
        }
        const specificEdges: Edge[] = this.edges.filter(edge => edge.id===specificEdgeId);
        specificEdges.forEach((edge) => {
            edge.isCentral = true;
        });
        return result;
    }

    returnDirectNeighbours(specificNodeId: id): [Node[], Edge[]]{
        // equivalent to getOutElems | getInElems
        const specificNode = this.nodes.find(node => node.id===specificNodeId) as Node;
        // this.setCenterNode(specificNode);
        const edges = this.edges.filter(edge => edge.fromNode.id === specificNodeId || edge.toNode.id === specificNodeId);
        const nodes: Node[] = [];
        edges.filter(e => {e.fromNode.id === specificNodeId ? nodes.push(e.toNode) : 
                                                              nodes.push(e.fromNode)});
        return [nodes.concat(specificNode), edges];
    }

    returnDirectNeighboursFromEdge(specificEdgeId: id): [Node[], Edge[]]{
        const predsAndSuccs: Node[] = this.nodes.filter(node => this.edges.some(edge => (edge.id === specificEdgeId && edge.toNode.id === node.id) || (edge.id === specificEdgeId && edge.fromNode.id === node.id)));
        const edges: Edge[] = this.edges.filter(edge => edge.id === specificEdgeId);
        edges.forEach(edge => edge.isCentral = true);
        return [predsAndSuccs, edges];
    }

    getOutElems(specificNodeId: id): [Node[], Edge[]]{
        const outEdges = this.edges.filter(edge => edge.fromNode.id === specificNodeId);
        const outNodes = outEdges.map(edge => edge.toNode);
        return [outNodes, outEdges];
    }

    getInElems(specificNodeId: id): [Node[], Edge[]]{
        const inEdges = this.edges.filter(edge => edge.toNode.id === specificNodeId);
        const inNodes = inEdges.map(edge => edge.fromNode);
        return [inNodes, inEdges];
    }

    // return a set of subgraphs spanned by the nodes associated to the given nodeIds. 
    getConnectedNodeComponents(nodeIds: string[], G: DAGraph): Map<string, Node[]>{
        const visited = new Set<string>();
        const components = new Map<string, Node[]>();
        let id = 0; // component id

        const visit = (n: Node, currId: number) => {
            visited.add(n.id);
            if(!components.has(id.toString())){
                components.set(id.toString(), [n]);
            } else {
                components.get(id.toString())!.push(n); // TODO: debug. current debug case does not have the zlr tag
            }
            const [neighbourNodes, _] = G.returnDirectNeighbours(n.id); 
            neighbourNodes.forEach(node => {
                if(nodeIds.includes(node.id) && !visited.has(node.id)){ // if result contains neighbour nodes
                    visit(node, currId);
                }
            })
        };

        nodeIds.forEach(nid => {
            if (!visited.has(nid)){
                visit(this.getNodeById(nid)!, id);
                id += 1;
            }
        });

        return components;
    }; 

    getSubgroups(F: (node: Node, fargs: any) => any, args: any, 
                 toGroupId?: (result: any, targs: any) => string, taggerArgs?: any): Map<string, Node[]>{
        const groups = new Map<string, Node[]>();
        this.nodes.forEach(node => {
            const result = F(node, args);
            const id = toGroupId ? `#${toGroupId(result, taggerArgs)}` : `#parentId: ${node.id}`; 
            if(!groups.has(id)){
                groups.set(id, [node]);
            } else {
                groups.get(id)!.push(node);
            }
        })
        return groups;
    }
}

/*
    Helper functions
*/
function getFwdRfEdges(node: ReactFlowNode, edges: ReactFlowEdge[]): ReactFlowEdge[]{
    return edges.filter(e => e.source === node.data.label);
}

function getBwdRfEdges(node: ReactFlowNode, edges: ReactFlowEdge[]): ReactFlowEdge[]{
    return edges.filter(e => e.target === node.data.label)
}

export function dfsRemoveRfElems(node: ReactFlowNode, direction: 'forward' | 'backward'): [string[], string[]] {
    const rfi = store.getState().reactFlow.rfi;
    const edges = rfi.getEdges();
    const nodeIds: Set<string> = new Set();
    const edgeIds: Set<string> = new Set();
    const isFwd = direction === 'forward';
    const add = (x, y) => x + y;

    const visit = (currNode: ReactFlowNode) => {
        const outEdges = isFwd ? getFwdRfEdges(currNode, edges) :  getBwdRfEdges(currNode, edges);

        outEdges.forEach(edge => {
            edgeIds.add(edge.id)

            if(isFwd){
                // currNode.data.numFwdActiveEdges -= 1;
                store.dispatch(setRFINodeData(
                    {
                        nodeId: currNode.id,
                        path: 'numFwdActiveEdges',
                        value: -1,
                        fromOwnProps: 'data.numFwdActiveEdges',
                        combine: add
                    }
                ));

                // sanity check
                if(rfi.getNode(currNode.id).data.numFwdActiveEdges < 0){
                    console.log("FWD WARNING: node ", currNode.id, " has NEGATIVE numFwdActiveEdges: ", currNode.data.numFwdActiveEdges);
                }
                const nextNodeId = edge.target;
                
                // nextNode.data.numBwdActiveEdges -= 1;
                store.dispatch(setRFINodeData(
                    {
                        nodeId: nextNodeId,
                        path: 'numBwdActiveEdges',
                        value: -1,
                        fromOwnProps: 'data.numBwdActiveEdges',
                        combine: add
                    }
                ));
                const nextNode = rfi.getNode(nextNodeId)!;
                if( nextNode.data.numBwdActiveEdges === 0){
                    nodeIds.add(nextNodeId);
                    visit(nextNode);
                }
            } else {
                // currNode.data.numBwdActiveEdges -= 1;
                store.dispatch(setRFINodeData(
                    {
                        nodeId: currNode.id,
                        path: 'numBwdActiveEdges',
                        value: -1,
                        fromOwnProps: 'data.numBwdActiveEdges',
                        combine: add
                    }
                ));

                // sanity check
                if(rfi.getNode(currNode.id).data.numBwdActiveEdges < 0){
                    console.log("BWD WARNING: node ", currNode.id, " has NEGATIVE numBwdActiveEdges: ", currNode.data.numBwdActiveEdges);
                }
                const nextNodeId = edge.source;
                
                // nextNode.data.numFwdActiveEdges -= 1;
                store.dispatch(setRFINodeData(
                    {
                        nodeId: nextNodeId,
                        path: 'numFwdActiveEdges',
                        value: -1,
                        fromOwnProps: 'data.numFwdActiveEdges',
                        combine: add
                    }
                ));

                const nextNode = rfi.getNode(nextNodeId)!;
                if( nextNode.data.numFwdActiveEdges === 0){
                    nodeIds.add(nextNodeId);
                    visit(nextNode);
                }
            }
        })
    }

    visit(node);
    return [Array.from(nodeIds), Array.from(edgeIds)]

}

/**
 *  @deprecated
 */
export function bfsRemoveRfElems(node: ReactFlowNode, direction: 'forward' | 'backward', rfi: ReactFlowInstance): [string[], string[]]{
    // returns an array of node ids and and array of edge ids that should be hidden
    const nodes = rfi.getNodes();
    const edges = rfi.getEdges();
    const nodeIds: Set<string> = new Set();
    const edgeIds: Set<string> = new Set();
    const isFwd = direction === 'forward';
    
    // get num fwd and bwd edges of all nodes in the expanded subgraph
    // defer visiting the node (i.e. modifying the number of active edges) until all fwd/bwd edges have been traversed
    // hence we do not modify the active edges num of a node that can be reached from mutually unreachable nodes
    const visitedNodes = {};
    edges.forEach(edge => {
        const srcNodeId = edge.source;
        const tgtNodeId = edge.target;

        if( visitedNodes[srcNodeId] === undefined){
            visitedNodes[srcNodeId] = {
                fwdEdgesToVisit: 1, 
                bwdEdgesToVisit: 0 
            };
        } else {
            visitedNodes[srcNodeId].fwdEdgesToVisit += 1;
        }

        if( visitedNodes[tgtNodeId] === undefined){
            visitedNodes[tgtNodeId] = {
                fwdEdgesToVisit: 0, 
                bwdEdgesToVisit: 1 
            };
        } else {
            visitedNodes[tgtNodeId].bwdEdgesToVisit += 1;
        }
    });

    const visit = (currNode: ReactFlowNode) => {
        const outEdges = isFwd ? getFwdRfEdges(currNode, edges) :  getBwdRfEdges(currNode, edges);

        // the node can be removed if there are no relevant active edges connecting it
        // dec. num active edges
        outEdges.forEach(edge => {
            // mark edge as hidden
            edgeIds.add(edge.id);
            if (isFwd){
                (currNode.data.numFwdActiveEdges as number) -= 1;
                visitedNodes[edge.target].bwdEdgesToVisit -= 1;
                (rfi.getNode(edge.target)!.data.numBwdActiveEdges as number) -= 1;
            } else {
                (currNode.data.numBwdActiveEdges! as number) -= 1;
                visitedNodes[edge.source].fwdEdgesToVisit -= 1;
                (rfi.getNode(edge.source)!.data.numFwdActiveEdges as number) -= 1;
            }
        });

        // mark node as hidden if all reachable paths have been visited and there are no active edges (inEdges if bwd, outEdges if fwd)
        outEdges.forEach(edge => {
            var nextNode: ReactFlowNode;
            if (isFwd){
                nextNode = rfi.getNode(edge.target)!;
                if(nextNode.data.numBwdActiveEdges === 0 && visitedNodes[nextNode.id].bwdEdgesToVisit === 0){
                    nodeIds.add(nextNode.id);
                    visit(nextNode);
                }
            } else {
                nextNode = rfi.getNode(edge.source)!;  
                if(nextNode.data.numFwdActiveEdges === 0 && visitedNodes[nextNode.id].fwdEdgesToVisit === 0){
                    nodeIds.add(nextNode.id);
                    visit(nextNode);
                }
            }
        })
    }

    visit(node);
    return [Array.from(nodeIds), Array.from(edgeIds)]
}

function getDataObjects(dataObjectsJSON: any): DataObject[]{
    var result: DataObject[] = [];
    const allDataObjects = Object.keys(dataObjectsJSON);
    allDataObjects.forEach(dataObject =>{
        const d = new DataObject(dataObject, dataObjectsJSON[dataObject]);
        result.push(d);
    });
    return result;
}

// may be deprecated in future versions
function getActions(actionsJSON: any, dataObjects: any): Action[] { // edge type
    const result: Action[] = [];
    const allActions: string[] = Object.keys(actionsJSON);
    allActions.forEach(actionId => {
        // collect input/outputIds
        const action = actionsJSON[actionId];
        const inputIds: string[] = [];
        const outputIds: string[] = [];
        if (action['inputIds']) action['inputIds'].forEach((id: string) => inputIds.push(id));
        if (action['outputIds']) action['outputIds'].forEach((id: string) => outputIds.push(id));
        if (action['inputId']) inputIds.push(action['inputId']);
        if (action['outputId']) outputIds.push(action['outputId']);

        // attributes for MLflow*Actions have non-standard namings...
        // maybe future versions that are compatible with more frameworks/libs should be considered
        if (action.type === 'MLflowPredictAction') inputIds.push(action.mlflowId);
        if (action.type === 'MLflowTrainAction') outputIds.push(action.mlflowId);

        inputIds.forEach((inputId: string) => {
            outputIds.forEach((outputId: string) => {
                const a = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, action);
                result.push(a);
            });
        });
    });
    return result;    
}

/*
    get action objects either as edges or both edges and nodes. the former one is used for the lineage graph that
    implements actions as edges. The latter one is used where both actions and data objects are nodes
    May need to be refactored
*/
function getActionsObjects(actionsJSON: any, dataObjects: any, getAll: boolean = false): Action[] | [ActionObject[], Action[]]{ // node type
    const edges: Action[] = [];
    const nodes: ActionObject[] = [];
    const allActions: string[] = Object.keys(actionsJSON);

    allActions.forEach(actionId => {
        const action = actionsJSON[actionId];

        // collect input/outputIds
        const inputIds: string[] = [];
        const outputIds: string[] = [];
        if (action['inputIds']) action['inputIds'].forEach((id: string) => inputIds.push(id));
        if (action['outputIds']) action['outputIds'].forEach((id: string) => outputIds.push(id));
        if (action['inputId']) inputIds.push(action['inputId']);
        if (action['outputId']) outputIds.push(action['outputId']);

        // attributes for MLflow*Actions have non-standard namings...
        // maybe future versions that are compatible with more frameworks/libs should be considered
        if (action.type === 'MLflowPredictAction') inputIds.push(action.mlflowId);
        if (action.type === 'MLflowTrainAction') outputIds.push(action.mlflowId);

        if (getAll){
            try {
                // an action is a node with incoming and outgoing edges
                const actionObject = new ActionObject(dataObjects.filter(o => inputIds.includes(o.id)), dataObjects.filter(o => outputIds.includes(o.id)), actionId, action);
                inputIds.forEach((inputId: string) => {
                    const doFrom = dataObjects.find((o: any) => o.id === inputId);
                    if (!doFrom) throw Error(`Cannot load lineage Action '${actionId}': inputId '${inputId}' not found in DataObjects`);
                    const incommingEdge = new Action(doFrom, actionObject, actionId + `_from_${inputId}`, action); 
                    edges.push(incommingEdge);
                });
                outputIds.forEach((outputId: string) => {
                    const doTo = dataObjects.find((o: any) => o.id === outputId);
                    if (!doTo) throw Error(`Cannot load lineage of Action '${actionId}': outputId '${outputId}' not found in DataObjects`);
                    const outgoingEdge = new Action(actionObject, doTo, actionId + `_to_${outputId}`, action);
                    edges.push(outgoingEdge);
                });
                nodes.push(actionObject);
            }
            catch (e) {
                console.log(e);
            }
        } else {
            // an action is treated as an edge, no merge needed
            inputIds.forEach((inputId: string) => {
                outputIds.forEach((outputId: string) => {
                    const edge = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, action);
                    edges.push(edge);
                });
            });
        }
    });

    if(getAll){
        return [nodes, edges];
    } else {
        return edges;   
    }     
}


//TODO: maybe refactor more code, e.g. extract nodes/edges forEach
// input types for nodes and edges are maybe too restrictive, only requires edge.id and node.width, height, positions and isCenterNode attributes
export function dagreLayout(nodes: Node[], edges: Edge[], direction: string = 'TB'): Node[] {

    //instantiate dagre Graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({});
    dagreGraph.setDefaultEdgeLabel(function() { return {}; });

    // set graph layout and the minimum between-node distance, ranksep is needed for computing all node distances
    dagreGraph.setGraph({ rankdir: direction, nodesep: 150, ranksep: 150});
    
    //add nodes + edges to the graph and calculate layout
    nodes.forEach((node)=>{
        dagreGraph.setNode(node.id, {width: node.width, height: node.height});
    });
    edges.forEach((edge) =>{
        dagreGraph.setEdge(edge.fromNode.id, edge.toNode.id);
    });
    dagre.layout(dagreGraph); 

    // Shift the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    // hardcode width and height for now
    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.position = {
            x: nodeWithPosition.x - node.width / 2,
            y: nodeWithPosition.y - node.height / 2,
        };
    });

    //If there is one Central Node, then shift its position to [0, 0] and shift all nodes as well
    // TODO: replace by if (this.centerNodeId === '')
    let centralNode =  nodes.find((node) => (node as Node).isCenterNode);
    if (centralNode) {
        let shiftX = centralNode.position.x;
        let shiftY = centralNode.position.y;
        nodes.forEach((node) => {
            node.position.x = node.position.x - shiftX;
            node.position.y = node.position.y - shiftY;
        });
    } 

    return nodes;
}

export function dagreLayoutRf(nodes: ReactFlowNode[], edges: ReactFlowEdge[], direction: string, nodeWidth: number, nodeHeight: number): ReactFlowNode[] {
    
    //instantiate dagre Graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({});
    dagreGraph.setDefaultEdgeLabel(function() { return {}; });

    // set graph layout and the minimum between-node distance, ranksep is needed for computing all node distances
    dagreGraph.setGraph({ rankdir: direction, nodesep: 150, ranksep: 150});
    
    //add nodes + edges to the graph and calculate layout
    nodes.forEach((node)=> dagreGraph.setNode(node.id, {width: nodeWidth, height: nodeHeight}));
    edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
    dagre.layout(dagreGraph); 

    // set layouted nodes position
    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.position = {x: nodeWithPosition.x, y: nodeWithPosition.y};
    });

    return nodes;
}

  
/* 
    Older versions of lineage graph constructors
*/
export default class DataObjectsAndActions extends DAGraph{
    constructor(public jsonObject: any){
        const dataObjects: DataObject[] = getDataObjects(jsonObject.dataObjects);
        const actions: Action[] = getActions(jsonObject.actions, dataObjects);
        const dataObjectsWithPosition: DataObject[] = dagreLayout(dataObjects, actions) as DataObject[];
        super(dataObjectsWithPosition, actions);
        this.jsonObject = jsonObject;
    }
}

export class PartialDataObjectsAndActions extends DAGraph{
    constructor(public nodes: Node[], 
                public edges: Edge[], 
                public layoutDirection:  string = 'TB',
                public jsonObject?: any){
        const nodesWithPos = dagreLayout(nodes, edges, layoutDirection);
        super(nodesWithPos, edges);
        this.jsonObject = jsonObject;
    }
}
  
/*
    Newer versions of lineage grpah constructors
    The graph is constructed by linking action and data nodes via unique ids
*/
export  class DataObjectsAndActionsSep extends DAGraph{ // TODO: make this default afterwards
    constructor(public jsonObject: ConfigData){
        const dataObjects: DataObject[] = getDataObjects(jsonObject.dataObjects);
        const [actionObjects, edges] = getActionsObjects(jsonObject.actions, dataObjects, true) as [ActionObject[], Action[]];
        const dataObjectsAndActions: Node[] = dataObjects.concat(actionObjects);
        const dataObjectsWithPosition = dagreLayout(dataObjectsAndActions, edges);
        console.log(actionObjects, edges)
        super(dataObjectsWithPosition, edges);
    }
}
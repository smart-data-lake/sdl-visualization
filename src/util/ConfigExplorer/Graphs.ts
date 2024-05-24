/*
    A general Graph structure that is used by React components
*/
import dagre from 'dagre';
import { ConfigData } from './ConfigData';



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

    setid(newid: string){
        this.id = newid;
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
    public levelOneNodes: Node[];

    constructor(nodes: Node[], edges: Edge[], mergeEdges: boolean = true){
        this.nodes = nodes; 
        this.edges = edges;
        this.levels = [];

        this.levelOneNodes = this.#computeLevelOneNodes();
        if (mergeEdges){
            this.#mergeCommonActionEdges(); 
            this.nodes = this.removeDuplicatesFromObjArrayOnAttributes(this.nodes, ["id"]);
            this.edges = this.removeDuplicatesFromObjArrayOnAttributes(this.edges, ["id"])
        }
    }

    /*
        Compute the list of nodes without incomming edges.
        If the graph is an ActionGraph, the nodes will be actionNodes, otherwise they will be dataNodes
    */
    #computeLevelOneNodes(){
        var destinationNodes: Node[] = [];
        this.edges.forEach(edge => {destinationNodes.push(edge.toNode)});
        const destNodes = [...new Set(destinationNodes)]; //Nodes with incoming edges (remove duplicates)
        return this.nodes.filter(x => !destNodes.includes(x)); //nodes without incoming edges
    }

    /*
        For every dataNode, merge all incoming action edges into a single edge with a singl actionNode.
        This should only affect the full graph, not data or action graph.
        After merging we assume that there are no action nodes with multiple incoming edges.
        We don't merge data graph or action graph

        There are cases where we have multiple actions of the same type but actually some of them are not related 
        e.g. {a1, a2, a3} -> d, all actions or of the same type, but {a1, a2} and a3 are not related, then we should not merge them 
        This is not implemented here because we cannot know if they are related or not from the way the graph is constructed -> future update possible
    */
    #mergeCommonActionEdges(){
        // merge actions and related edges by looking at non root data nodes, skip M:N  and 1:N actions 
        // merging is done by jsonObj.type, not by actionNode.id
        const nonRootNodes = this.nodes.filter(n => !this.levelOneNodes.includes(n) && n.nodeType === NodeType.DataNode);

        nonRootNodes.forEach(node => {
            // skip M:N cases
            // get incomming edges from actions to current dataNode and filter them by action type
            // data objects can NOT be directly connected to each other
            const actionSet = new Map<string, [DataObject[], Edge[], ActionObject[], string]>(); // action id: actionNodes
            this.edges.filter(edge => edge.toNode === node).forEach(edge => {
                const currAction = edge.fromNode as ActionObject;
                const actionType = currAction.getActionType();
                const actionId = currAction.id;

                // keep track of nodes in every type of action
                // this works because we have guarantee that pred(pred(n)) of a dataNode n will be a dataNode
                const relatedDataObj = this.#getEdgePredecessor(edge).fromNode as DataObject; 
                if (actionSet.has(actionType)) {
                    const actionSetEntry = actionSet.get(actionType)!;
                    actionSetEntry[0].push(relatedDataObj);
                    actionSetEntry[1].push(edge);
                    actionSetEntry[2].push(currAction);
                } else {
                    actionSet.set(actionType, [[relatedDataObj], [edge], [currAction], actionId]);
                }
            });

            // merge edges if we have multiple data objects for the action input
            // replace part of this.edges by merged edges and part of this.nodes by an unified node
            for (const [actionType, dataObjsAndEdges] of actionSet){
                if (dataObjsAndEdges.length > 1){
                    const dataObjs = dataObjsAndEdges[0];
                    const edges = dataObjsAndEdges[1];
                    const relatedActionObjects = dataObjsAndEdges[2]
                    const actionId = dataObjsAndEdges[3];

                    // create new action node that unifies the edges and link the source nodes to it
                    const jsonObjs =  Object.fromEntries(relatedActionObjects.map(x => [x.jsonObject]));
                    jsonObjs["type"] = actionType;

                    const newActionNode = new ActionObject(dataObjs, [node], actionId, jsonObjs);
                    this.nodes.push(newActionNode);
                    this.edges.push(new Edge(newActionNode, node, `${newActionNode.id}=${actionType}=${node.id}`));
                    dataObjs.forEach(d => {
                        this.edges.push(new Edge(d, newActionNode, `${d.id}=${actionType}=${actionId}`, actionId)) //
                    });

                    // remove redundant nodes and edges
                    edges.forEach(e => {
                        this.edges.splice(this.edges.indexOf(e), 1); 
                        this.edges.splice(this.edges.indexOf(this.#getEdgePredecessor(e)), 1);
                        this.nodes.splice(this.nodes.indexOf(e.fromNode), 1);
                    })
                }
            }
        });
    }

    /**
     * Remove elements from array that have the same specified attributes.
     * 
     * @param {T} arr - The array we want to filter
     * @param {string[]} attr - An array of attributes we want to filter on. If undefined, this function returns the unmodified input array.
     * 
     * @returns {T} The filtered array
     */
    removeDuplicatesFromObjArrayOnAttributes<T>(arr: T[], attr: string[] | undefined){ 
        if (attr !== undefined){
            if (attr!.length === 0){
                return [...new Map(arr.map(v => [JSON.stringify(v), v])).values()];
            } else {
                return arr.filter((v,i,a) => a.findIndex(v2 => attr.every(k => v2[k] === v[k])) === i)
            }
        } else {
            return arr;
        }
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

    setLayout(layout: string){
        if(['TB', 'LR'].includes(layout)){
            const nodesWithPos = computeNodePositions(this.nodes, this.edges, layout);
            this.setNodes(nodesWithPos);
        } else {
            console.log(`"layout ${layout} is not supported. Please use 'TB' or 'LR'`);
        }
    }

    getNodeById(identifier: string){
        return this.nodes.find(node => node.id === identifier);
    }

    getEdgeById(identier: string){
        return this.edges.find(edge => edge.id === identier);
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
        return new DAGraph(newNodes, [...newEdges.values()], false);
    }
    
    /**
     * Returns a new graph with ActionObject as ndoes. The edges are built by connecting neighbouring actions.
     *  In rare case, an action object can have multiple incoming and outgoing edges

        Caveat: this assumes that we are in full graph view

     * merge n-ary action functions, e.g. if D1 -> A and D2 -> A, then merge D1 and D2 into a single action node 
     * while it could be the case that the out degree of the action node is > 1, we can merge by only looking
     * at the in-degree of the action node 
     */

    getActionGraph(): DAGraph {
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

        return new DAGraph(newNodes, newEdges, false);
    }

    //Returns the nodes and edges of a partial graph based on a specific node (predecessors and succesors) as a pair
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
        specificNode.isCenterNode = true;
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
        const specificNode = this.nodes.find(node => node.id===specificNodeId) as Node;
        specificNode.isCenterNode = true;
        const edges = this.edges.filter(edge => edge.fromNode.id === specificNodeId || edge.toNode.id === specificNodeId);
        const nodes: Node[] = [];
        edges.filter(e => {e.fromNode.id === specificNodeId? 
                                                            nodes.push(e.toNode) : 
                                                            nodes.push(e.fromNode)});
        return [nodes.concat(specificNode), edges];
    }

    returnDirectNeighboursFromEdge(specificEdgeId: id): [Node[], Edge[]]{
        const predsAndSuccs: Node[] = this.nodes.filter(node => this.edges.some(edge => (edge.id === specificEdgeId && edge.toNode.id === node.id) || (edge.id === specificEdgeId && edge.fromNode.id === node.id)));
        const edges: Edge[] = this.edges.filter(edge => edge.id === specificEdgeId);
        edges.forEach(edge => edge.isCentral = true);
        return [predsAndSuccs, edges];
    }
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
    const result: Action[] = [];
    const actionNodes: ActionObject[] = [];
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
            inputIds.forEach((inputId: string) => {
                outputIds.forEach((outputId: string) => {
                    const doFrom = dataObjects.find((o: any) => o.id === inputId);
                    const doTo = dataObjects.find((o: any) => o.id === outputId);
                    const actionObject = new ActionObject(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, action);
                    actionNodes.push(actionObject);

                    // create id for incomming and outgoing edges to the action object
                    const incommingEdge = new Action(doFrom, actionObject, actionId + `"_from_${inputId}"`, action); 
                    const outgoingEdge = new Action(actionObject, doTo, actionId + `"_to_${outputId}"`, action);
                    result.push(incommingEdge);
                    result.push(outgoingEdge);
                });
            });
        } else {
            // an action is treated as an edge, no merge needed
            inputIds.forEach((inputId: string) => {
                outputIds.forEach((outputId: string) => {
                    const a = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, action);
                    result.push(a);
                });
            });
        }
        
    });

    if(getAll){
        return [actionNodes, result];
    } else {
        return result;   
    }     
}


//TODO: maybe refactor more code, e.g. extract nodes/edges forEach
export function computeNodePositions(nodes: Node[], edges: Edge[], direction: string = 'TB'): Node[] {
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
    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.position = {
        x: nodeWithPosition.x - node.width / 2,
        y: nodeWithPosition.y - node.height / 2,
        };
        return node;
    });

    //If there is one Central Node, then shift its position to [0, 0] and shift all nodes as well
    let centralNode = nodes.find((node) => node.isCenterNode);
    if (centralNode) {
        let shiftX = centralNode.position.x;
        let shiftY = centralNode.position.y;
        let shiftedNodes = nodes.filter((node) => !node.isCenterNode); //See if deep copy needed with strucuturedClone() !!
        shiftedNodes.forEach((node) => {
            node.position.x = node.position.x - shiftX;
            node.position.y = node.position.y - shiftY;
        });
        centralNode.position.x = 0; //See if deep copy needed with strucuturedClone(), as we're altering our nodes.
        centralNode.position.y = 0;
        shiftedNodes.push(centralNode);
        nodes = shiftedNodes;
    } 

    return nodes;
}
  
/* 
    Older versions of lineage graph constructors
*/
export default class DataObjectsAndActions extends DAGraph{
    constructor(public jsonObject: any){
        const dataObjects: DataObject[] = getDataObjects(jsonObject.dataObjects);
        const actions: Action[] = getActions(jsonObject.actions, dataObjects);
        const dataObjectsWithPosition: DataObject[] = computeNodePositions(dataObjects, actions) as DataObject[];
        super(dataObjectsWithPosition, actions);
        this.jsonObject = jsonObject;
    }
}

export class PartialDataObjectsAndActions extends DAGraph{
    constructor(public nodes: Node[], 
                public edges: Edge[], 
                public layout_direction:  string = 'TB',
                public jsonObject?: any){
        const nodesWithPos = computeNodePositions(nodes, edges, layout_direction);
        super(nodesWithPos, edges, false); // don't merge actions, merging should have already been done because we call this from a full graph
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
        const dataObjectsWithPosition = computeNodePositions(dataObjectsAndActions, edges) as Node[]; 
        super(dataObjectsWithPosition, edges);
        this.jsonObject = jsonObject;
    }
}
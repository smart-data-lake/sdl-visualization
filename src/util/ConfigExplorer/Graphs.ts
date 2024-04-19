/*
    A general Graph structure that is used by React components

    TODO list:
    - Add more overriding methods for partial graphs
    - refactor, remove redundant code
    - add grouped graph
*/
import { NoEncryption } from '@mui/icons-material';
import dagre from 'dagre';

const central_node_color = '#addbff';

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

export abstract class Node{
    public id: id;
    public position: position;
    public width: number;
    public height: number;
    public level: number;
    public backgroundColor: string;
    public isCenterNode: boolean;
    public data: {id: string};
    public nodeType: NodeType;
    public fromNodes: Node[];
    public toNodes: Node[];

    constructor(id: id, nodeType?: NodeType, position?: {x: number, y: number}, level: number = -1, fromNodes?: Node[], toNodes?: Node[]){
        this.id = id;
        this.level = level //level defines the longest path starting from all input nodes
        this.position = position ? position : {x:0, y:0};
        this.width = 172;
        this.height = 36;
        this.backgroundColor = '#FFFFFF';
        this.isCenterNode = false;
        this.data = {id: this.id}
        this.nodeType = (nodeType !== undefined) ? nodeType : NodeType.CommonNode;
        this.fromNodes = fromNodes ? fromNodes : [];
        this.toNodes = toNodes ? toNodes : [];
    }

    setid(newid: string){
        this.id = newid;
    }
} 

// TODO: can be simplified in future versions, does not have to store that many attirbutes
export class Edge{

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

export class DAGraph { 
    public nodes: Node[];
    public edges: Edge[];
    public levels: number[];
    public destNodes: Node[];
    public levelOneNodes: Node[];

    constructor(nodes: Node[], edges: Edge[]){
        this.nodes = nodes; //maybe remove if not necessary
        this.edges = edges;
        this.levels = [];
        var destinationNodes: Node[] = [];
        this.edges.forEach(edge => {destinationNodes.push(edge.toNode)});
        this.destNodes = [...new Set(destinationNodes)]; //Nodes with incoming edges (remove duplicates)
        this.levelOneNodes = this.nodes.filter(x => !destinationNodes.includes(x)); //nodes without incoming edges
        // this.#mergeCommonActionEdges(); // testing
    }

    /*
        For every dataNode, merge all incoming action edges into a single edge with a singl actionNode
        This should only affect the full graph, not data or action graph
        At this point we assume that there are no action nodes with multiple incoming edges

        It is a degenerate case when we have multiple actions of the same type but actually some of them are not related 
        e.g. {a1, a2, a3} -> d, all actions or of the same type, but {a1, a2} and a3 are not related, then we should not merge them 
        This is not implemented here because we cannot know if they are related or not from the way the graph is constructed -> future update possible
    */
    #mergeCommonActionEdges(){
        const dataNodes = this.nodes.filter(node => node.nodeType === NodeType.DataNode);
        const newEdges: Edge[] = [];
        dataNodes.forEach(node => {
            const actionSet = new Map<string, ActionObject[]>(); // action id: actionNodes
            const relatedDataObjs: DataObject[] = [];
            this.edges.filter(edge => edge.toNode === node && edge.fromNode.nodeType === NodeType.ActionNode).forEach(edge => {
                const currAction = edge.fromNode;
                const actionType = (currAction as ActionObject).getActionType();
                actionSet.has(actionType) ? actionSet.get(actionType).push(edge.fromNode as ActionObject) : actionSet.set(actionType, [edge.fromNode]);
                const relatedDataObj = edge.fromNode.fromNodes[0] as DataObject; // assume only on input node
                relatedDataObjs.push(relatedDataObj);
                // remove redundant nodes
                this.nodes.splice(this.nodes.indexOf(edge.fromNode), 1);
            });

            for (const [actionType, relatedActionObjs] of actionSet){
                if (relatedActionObjs.length > 1){
                    const newActionNode = new ActionObject(relatedActionObjs,[node], actionType, {type: relatedActionObjs[0].getActionType()});
                    this.nodes.push(newActionNode);
                    newEdges.push(new Edge(newActionNode, node, actionType));
                    relatedDataObjs.forEach(d => {
                        newEdges.push(new Edge(d, newActionNode, actionType))
                    });
                } else {
                    newEdges.push(new Edge(relatedActionObjs[0], node, actionType));
                    relatedDataObjs.forEach(d => {
                        newEdges.push(new Edge(d, relatedActionObjs[0], actionType))
                    });
                
                }
            }
        });
        this.edges = newEdges;
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
        Returns a new graph with dataObject as nodes. potentially slow
        maybe creating action and dataobj graphs separately on initialization is better

        Caveat: this assumes that we have a full graph view

        TODO: may be simplified when we merge the actions when constructing the graph, see {@link mergeCommonEdges}
    */
    getDataGraph(): DAGraph {
        const newEdges: Edge[] = [];
        const newNodes = this.nodes.filter(node => node.nodeType === NodeType.DataNode);

        this.nodes.filter(node => node.nodeType === NodeType.ActionNode).forEach(a => {
            this.edges.filter(ie => ie.toNode.id === a.id).forEach(in_edge => {
                this.edges.filter(oe => oe.fromNode.id === a.id).forEach(out_edge => {
                    newEdges.push(new Edge(in_edge.fromNode, out_edge.toNode, in_edge.fromNode.id + '->' + a.id + '->' + out_edge.toNode.id));
                });
            });
        });

        return new DAGraph(newNodes, newEdges);
    }
    
    /**
     * 
     * Returns a new graph with ActionObject as ndoes. The edges are built by connecting neighbouring actions.
     *  In rare case, an action object can have multiple incoming and outgoing edges

        Caveat: this assumes that we have a full graph view

     * merge n-ary action functions, e.g. if D1 -> A and D2 -> A, then merge D1 and D2 into a single action node 
     * while it could be the case that the out degree of the action node is > 1, we can merge by only looking
     * at the in-degree of the action node 
     * 
     * TODO: will be updated with merge common actions
     */

    getActionGraph(): DAGraph {
        const actions = this.nodes.filter(node => node.nodeType === NodeType.ActionNode) as ActionObject[];
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const processed = new Set<string>();

        // add source and sink nodes
        const srcNode = new CommonNode("source");
        const sinkNode = new CommonNode("sink");
        newNodes.push(srcNode);
        newNodes.push(sinkNode);
      
        actions.forEach(action => {
          const actionId = action.id; // actionId = fromNode.id-toNode.id
          const actionType = action.getActionType();

            if (!processed.has(action.id)) { 
                // Find all actions that are part of the same N-ary function
                // a.
                // const relatedActions = actions.filter(a => {
                //     return a.getActionType() === actionType &&
                //            this.nodes.some(n => a.toNodes.includes(n) === action.toNodes.includes(n))
                // }); 
                const relatedActions = actions.filter(a => a.getActionType() === actionType && a.toNode.id === action.toNode.id)
                relatedActions.forEach(a => processed.add(a.id));
                const relatedActionSourceIds = relatedActions.map((a)=>a.fromNode.id)

                // Merge related actions into a single action node and rename
                // temporarily reomved ${counter++}:merged- prefix
                const newFromNodeId = `merged-from-${actionId}`; // maybe need to concat all actio ids
                const newToNodeId = `merged-to-${actionId}`;
                const newActionId = actionId;
                const newFromNode = new DataObject(newFromNodeId);
                const newToNode = new DataObject(newToNodeId);
                const mergedAction = new ActionObject(newFromNode, newToNode, newActionId, {type: actionType});
                newNodes.push(mergedAction);

                // the next 2 lines can be simplified/without usinbg set when we merge the nodes while constructing the graph, later on that
                // last actions can be duplicates since we searc in the full graph
                const uniqueLastActions = {}
                const lastActions = actions.filter(a => {
                    return relatedActionSourceIds.includes(a.toNode.id) && (uniqueLastActions.hasOwnProperty(a.toNode.id) ? false : (uniqueLastActions[a.toNode.id] = true));
                });

                if (lastActions.length > 0) {
                    lastActions.forEach(la => { // no duplicates here
                        newEdges.push(new Edge(la, mergedAction, `${la.id}->${newActionId}`));
                    });
                }
           }
        });

        return new DAGraph(newNodes, newEdges);
    }

    // // TODO
    // getGroupedGraph(attribute: any){

    // }


    //Returns the nodes and edges of a partial graph based on a specific node (predecessors and succesors) as a pair
    returnPartialGraphInputs(specificNodeId:id, colorNode:boolean = true): [Node[], Edge[]]{
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

        const specificNode = this.nodes.find(node => node.id===specificNodeId) as Node;
        console.log("spec node id (part graph inputs): ", specificNodeId);
        this.nodes.forEach(node => console.log(node.id));
        console.log("spec node (part graph inputs): ", specificNode)
        console.log("specific node (ret  part graph inputs): ", specificNode)
        specificNode.isCenterNode = true;
        if(colorNode){specificNode.backgroundColor=central_node_color;}
        const nodes = setAsArray(union(predecessors(specificNodeId, this)[0] as Set<Node>, successors(specificNodeId, this)[0] as Set<Node>));//merge predeccessors and successors     
        nodes.push(specificNode as Node); //add the central/origin node itself
        const edges = setAsArray(union(predecessors(specificNodeId, this)[1] as Set<Edge>, successors(specificNodeId, this)[1] as Set<Edge>));   

        return [nodes, edges];
    }

    returnPartialGraphInputsFromEdge(specificEdgeId: id){
        let edgesWithId = this.edges.filter(edge => edge.id === specificEdgeId);
        let result: [Node[], Edge[]] = [[], []];
        for (let i = 0 ; i < edgesWithId.length ; i++){
            let [nodesNext, edgesNext] = this.returnPartialGraphInputs(edgesWithId[i].toNode.id, false);
            result = [setAsArray(union(new Set(result[0]), new Set(nodesNext))), setAsArray(union(new Set(result[1]), new Set(edgesNext)))]
        }
        const specificEdges: Edge[] = this.edges.filter(edge => edge.id===specificEdgeId);
        specificEdges.forEach((edge) => {
            edge.isCentral = true;
        });
        return result;
    }

    returnDirectNeighbours(specificNodeId: id, colorNode:boolean = true): [Node[], Edge[]]{
        const specificNode = this.nodes.find(node => node.id===specificNodeId) as Node;
        console.log("spec node id (direct neighbours): ", specificNodeId)
        console.log("spec node (direct neighbours): ", specificNode)
        console.log("specific node (ret direct neighbours): ", specificNode)
        specificNode.isCenterNode = true;
        if(colorNode){specificNode.backgroundColor=central_node_color;}
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

/*
    A newer implementation of the Graph structure that is used by the Lineage Grpph
    Both DataObjects and Actions will be represented as Nodes 
*/
class CommonNode extends Node{
    public data: any;

    constructor(id: id, data?: any){
        super(id, NodeType.CommonNode);
        this.data = data;
    }
}

export class ActionObject extends Node {
    public jsonObject?: any;
    // public fromNodes: Node[];
    // public toNodes: Node[];
    public fromNode: Node;
    public toNode: Node;

    constructor(fromNode: Node, toNode: Node, id: id, jsonObject?: any){
        super(id, NodeType.ActionNode);
        this.jsonObject = jsonObject;
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.jsonObject = jsonObject;
    }

    getActionType(): string {
        if (this.jsonObject){
            return this.jsonObject.type;
        } else {
            console.warn('Cannot read action type, ActionObject does not have a jsonObject. Returning AnyType');
            return 'AnyType';
            // console.error('Cannot read action type, ActionObject does not have a jsonObject.');
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
            // merge data and action nodes here TODO
            inputIds.forEach((inputId: string) => {
                outputIds.forEach((outputId: string) => {
                    const doFrom = dataObjects.find((o: any) => o.id === inputId);
                    const doTo = dataObjects.find((o: any) => o.id === outputId);
                    const actionObject = new ActionObject(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, action);
                    actionNodes.push(actionObject);
                    console.log("create action object: ", actionObject);

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
    dagreGraph.setGraph({ rankdir: direction, nodesep: 200, ranksep: 200});
    
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
        const dataObjectsWithPosition: DataObject[] = computeNodePositions(dataObjects, actions) as DataObject[]; //Downcasting because the function returns a Node[]
        super(dataObjectsWithPosition, actions);
        this.jsonObject = jsonObject;
    }
}

export class PartialDataObjectsAndActions extends DAGraph{
    constructor(public nodes: Node[], public edges: Edge[], public layout_direction:  string = 'TB', public jsonObject?: any){
        const nodesWithPos = computeNodePositions(nodes, edges, layout_direction);
        super(nodesWithPos, edges);
        this.jsonObject = jsonObject;
    }
}
  
/*
    Newer versions of lineage grpah constructors
    The graph is constructed by linking action and data nodes via unique ids
*/
export  class DataObjectsAndActionsSep extends DAGraph{ // TODO: make this default afterwards
    constructor(public jsonObject: any){
        const dataObjects: DataObject[] = getDataObjects(jsonObject.dataObjects);
        const [actionObjects, edges] = getActionsObjects(jsonObject.actions, dataObjects, true) as [ActionObject[], Action[]];
        const dataObjectsAndActions: Node[] = dataObjects.concat(actionObjects);
        const dataObjectsWithPosition = computeNodePositions(dataObjectsAndActions, edges) as Node[]; 
        super(dataObjectsWithPosition, edges);
        this.jsonObject = jsonObject;
    }
}
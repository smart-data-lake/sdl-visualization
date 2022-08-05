import dagre from 'dagre';

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
    y: number
}

class Node{
    public id: id;
    public position: position;
    public width: number;
    public height: number;
    public level: number;

    constructor(id: id, level: number = -1){
        this.id = id;
        this.level = level //level defines the longest path starting from all input nodes
        this.position = {x:0, y:0};
        this.width = 172;
        this.height = 36;
    }
} 

class Edge{
    constructor(public fromNode: Node, public toNode: Node, public id: id){
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.id = id; //Ids are not unique identifiers, since we can have the same Edge/Action connecting several Nodes/DataObjects.
    }
}


class DAGraph{ //problem: we're not checking if the graph is acyclic.

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

        this.changeLevelForAllNodes(); //compute levels for all nodes
        this.computeLevelsList();
        
    }

    //Returns the nodes and edges of a partial graph based on a specific node (direct predecessors and succesors) as a pair
    returnPartialGraphInputs(specificNodeId:id){
        function predecessors(nodeId: id, graph: DAGraph){
            var nodes = new Set<Node>;
            var edges = new Set<Edge>;
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
            var nodes = new Set<Node>;
            var edges = new Set<Edge>;
            graph.edges.forEach(edge =>{
                if (edge.fromNode.id === specificNodeId){
                    let succ = successors(edge.toNode.id, graph);
                    nodes.add(edge.toNode);
                    nodes = union(nodes, succ[0] as Set<Node>);
                    edges.add(edge);
                    edges = union(edges, succ[1] as Set<Edge>);
                }
            });
            return [nodes, edges];
        }

        const specificNode = this.nodes.find(node => node.id===specificNodeId);
        const nodes = setAsArray(union(predecessors(specificNodeId, this)[0] as Set<Node>, successors(specificNodeId, this)[0] as Set<Node>));//merge predeccessors and successors     
        nodes.push(specificNode as Node); //add the central/origin node itself
        const edges = setAsArray(union(predecessors(specificNodeId, this)[1] as Set<Edge>, successors(specificNodeId, this)[1] as Set<Edge>));   

        return [nodes, edges];
    }


    longestPath(destNode: Node): number { //defines level of a node
        var result = 0
        if (this.destNodes.includes(destNode)){
            var incomingEdges = this.edges.filter(edge => edge.toNode === destNode);
            var incomingNodesLongestPath = incomingEdges.map(edge => this.longestPath(edge.fromNode));
            //console.log(destNode);
            //console.log(incomingNodesLongestPath);
            result = Math.max(...incomingNodesLongestPath)+1;
        }
        return result
    }

    changeLevelForAllNodes(): void {
        this.nodes.forEach(node => {
            node.level = this.longestPath(node)
        })
    }

    computeLevelsList(){
        this.nodes.forEach(node =>{
            if (this.levels[node.level]===undefined){
                this.levels[node.level] = 1;
            } 
            else{
                this.levels[node.level] += 1;
            }
        });
    }
}


export class DataObject extends Node {
    public jsonObject: any;

    constructor(id: id, jsonObject: any){
        super(id);
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


function getDataObjects(dataObjectsJSON: any){
    var result: DataObject[] = [];
    const allDataObjects = Object.keys(dataObjectsJSON);
    allDataObjects.forEach(dataObject =>{
        const d = new DataObject(dataObject, dataObjectsJSON[dataObject]);
        result.push(d);
    });
    return result;
}

function getActionAux(actionObject: any){
    if (actionObject['inputIds'] !== undefined && actionObject['outputIds'] !== undefined){return 'n-to-n'};
    if (actionObject['inputIds'] === undefined && actionObject['outputIds'] !== undefined){return '1-to-n'};
    if (actionObject['inputIds'] === undefined && actionObject['outputIds'] !== undefined){return 'n-to-1'};
    if (actionObject['inputIds'] === undefined && actionObject['outputIds'] === undefined){return '1-to-1'};
}


function getActions(actionsJSON: any, dataObjects: any){
    var result: Action[] = [];
    const allActions: string[] = Object.keys(actionsJSON);
    allActions.forEach(actionId => {
        if (getActionAux(actionsJSON[actionId])==='n-to-n'){
            actionsJSON[actionId]['inputIds'].forEach((inputId: string | number) => {
                actionsJSON[actionId]['outputIds'].forEach((outputId: string | number) =>{
                    const a = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, actionsJSON[actionId]);
                    result.push(a);
                });
            });
        }
        else if (getActionAux(actionsJSON[actionId])==='1-to-n'){
            actionsJSON[actionId]['outputIds'].forEach((outputId: string | number) =>{
                const inputId = actionsJSON[actionId]['inputId'];
                const a = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, actionsJSON[actionId]);
                result.push(a);
            });
        }
        else if (getActionAux(actionsJSON[actionId])==='n-to-1'){
            actionsJSON[actionId]['inputIds'].forEach((inputId: number | string) =>{
                const outputId = actionsJSON[actionId]['outputId'];
                const a = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o: any) => o.id === outputId), actionId, actionsJSON[actionId]);
                result.push(a);
            });
        }
        else {
            const inputId = actionsJSON[actionId]['inputId'];
            const outputId = actionsJSON[actionId]['outputId'];
            const a = new Action(dataObjects.find((o: any) => o.id === inputId), dataObjects.find((o:any) => o.id === outputId), actionId, actionsJSON[actionId]);
            result.push(a);
        }
    });
    return result;    
}


function computeNodePositions(nodes: Node[], edges: Edge[]){
    //instantiate dagre Graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({});
    dagreGraph.setDefaultEdgeLabel(function() { return {}; });
    
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
        //node.targetPosition = isHorizontal ? 'left' : 'top'; //To know where the edge starts (optional)
        //node.sourcePosition = isHorizontal ? 'right' : 'bottom'; //(Optional)
        node.position = {
        x: nodeWithPosition.x - node.width / 2,
        y: nodeWithPosition.y - node.height / 2,
        };
        return node;
    });
    return nodes;
}

  
export default class DataObjectsAndActions extends DAGraph{
    constructor(public jsonObject: any){
        const dataObjects: DataObject[] = getDataObjects(jsonObject.dataObjects);
        const actions: Action[] = getActions(jsonObject.actions, dataObjects);
        const dataObjectsWithPosition: DataObject[] = computeNodePositions(dataObjects, actions) as DataObject[]; //Downcasting because the function returns a Node[]
        super(dataObjectsWithPosition, actions);
        this.jsonObject = jsonObject;
    }
  }
  





/*
const n1 = new Node('1')
const n2 = new Node('2')
const n3 = new Node('3')
const n4 = new Node('4')
const n5 = new Node('5')
const n6 = new Node('6')
const n7 = new Node('7')
const n8 = new Node('8')
const n9 = new Node('9')

const e41 = new Edge(n4, n1, "e41")
const e42 = new Edge(n4, n2, "e42")
const e43 = new Edge(n4, n3, "e43")
const e17 = new Edge(n1, n7, "e17")
const e28 = new Edge(n2, n8, "e28")
const e36 = new Edge(n3, n6, "e36")
const e75 = new Edge(n7, n5, "e75")
const e26 = new Edge(n2, n6, "e26")
const e85 = new Edge(n8, n5, "e85")
const e86 = new Edge(n8, n6, "e86")
const e96 = new Edge(n9, n6, "e96")

const g = new DAGraph([n1, n2, n3, n4, n5, n6, n7, n8, n9], [e41, e42, e43, e17, e28, e36, e75, e26, e85, e86, e96])
const partial = g.returnPartialGraphInputs('5');
*/
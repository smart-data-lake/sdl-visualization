const { DangerousRounded } = require('@mui/icons-material');
const dagre = require('dagre');


class Node{

    constructor(id, level = -1){
        this.id = id;
        this.level = level //level defines the longest path starting from all input nodes
        this.position = {x:0, y:0};
        this.width = 172;
        this.height = 36;
    }
} 

class Edge{
    constructor(fromNode, toNode, id){
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.id = id; //Ids are not unique identifiers, since we can have the same Edge/Action connecting several Nodes/DataObjects.
    }
}


class DAGraph{ //problem: we're not checking if the graph is acyclic.




    constructor(nodes, edges){
        this.nodes = nodes; //maybe remove if not necessary
        this.edges = edges;
        this.levels = [];

        var destinationNodes = [];
        this.edges.forEach(edge => {destinationNodes.push(edge.toNode)});
        this.destNodes = [...new Set(destinationNodes)]; //Nodes with incoming edges (remove duplicates)
        this.levelOneNodes = this.nodes.filter(x => !destinationNodes.includes(x)); //nodes without incoming edges

        this.changeLevelForAllNodes(); //compute levels for all nodes
        this.computeLevelsList();
        
    }


    longestPath(destNode) { //defines level of a node
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

    changeLevelForAllNodes() {
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


class DataObject extends Node {

    constructor(id, jsonObject){
        super(id);
        this.jsonObject = jsonObject;
    }
  }
  
class Action extends Edge {

    constructor(fromNode, toNode, id, jsonObject){
        super(fromNode, toNode, id);
        this.jsonObject = jsonObject;
    }
  }


function getDataObjects(dataObjectsJSON){
    var result = [];
    const allDataObjects = Object.keys(dataObjectsJSON);
    allDataObjects.forEach(dataObject =>{
        const d = new DataObject(dataObject, dataObjectsJSON[dataObject]);
        result.push(d);
    });
    return result;
}

function getActionAux(actionObject){
    if (actionObject['inputIds'] !== undefined && actionObject['outputIds'] !== undefined){return 'n-to-n'};
    if (actionObject['inputIds'] === undefined && actionObject['outputIds'] !== undefined){return '1-to-n'};
    if (actionObject['inputIds'] === undefined && actionObject['outputIds'] !== undefined){return 'n-to-1'};
    if (actionObject['inputIds'] === undefined && actionObject['outputIds'] === undefined){return '1-to-1'};
}


function getActions(actionsJSON, dataObjects){
    var result = [];
    const allActions = Object.keys(actionsJSON);
    allActions.forEach(actionId => {
        if (getActionAux(actionsJSON[actionId])==='n-to-n'){
            actionsJSON[actionId]['inputIds'].forEach((inputId) => {
                actionsJSON[actionId]['outputIds'].forEach((outputId) =>{
                    const a = new Action(dataObjects.find((o) => o.id === inputId), dataObjects.find((o) => o.id === outputId), actionId, actionsJSON[actionId]);
                    result.push(a);
                });
            });
        }
        else if (getActionAux(actionsJSON[actionId])==='1-to-n'){
            actionsJSON[actionId]['outputIds'].forEach((outputId) =>{
                const inputId = actionsJSON[actionId]['inputId'];
                const a = new Action(dataObjects.find((o) => o.id === inputId), dataObjects.find((o) => o.id === outputId), actionId, actionsJSON[actionId]);
                result.push(a);
            });
        }
        else if (getActionAux(actionsJSON[actionId])==='n-to-1'){
            actionsJSON[actionId]['inputIds'].forEach((inputId) =>{
                const outputId = actionsJSON[actionId]['outputId'];
                const a = new Action(dataObjects.find((o) => o.id === inputId), dataObjects.find((o) => o.id === outputId), actionId, actionsJSON[actionId]);
                result.push(a);
            });
        }
        else {
            const inputId = actionsJSON[actionId]['inputId'];
            const outputId = actionsJSON[actionId]['outputId'];
            const a = new Action(dataObjects.find((o) => o.id === inputId), dataObjects.find((o) => o.id === outputId), actionId, actionsJSON[actionId]);
            result.push(a);
        }
    });
    return result;    
}

function computeNodePositions2(nodes){

    var dagreGraph = new dagre.graphlib.Graph();
            // Set an object for the graph label
    dagreGraph.setGraph({});

            // Default to assigning a new object as a label for each new edge.
    dagreGraph.setDefaultEdgeLabel(function() { return {}; });
    
    nodes.forEach((node)=>{
        dagreGraph.setNode(node.id, {label: node.id, width: node.width, height: node.height});
    });

    const edges = [
        {from: "4", to: "1", id:"e41"},
        {from: "4", to: "2", id:"e42"},
        {from: "4", to: "3", id:"e43"},
        {from: "1", to: "7", id:"e17"},
        {from: "2", to: "8", id:"e28"},
        {from: "3", to: "6", id:"e36"},
        {from: "7", to: "5", id:"e75"},
        {from: "2", to: "6", id:"e26"},
        {from: "8", to: "5", id:"e85"},
        {from: "8", to: "6", id:"e86"},
        {from: "9", to: "6", id:"e96"},
    ];
    edges.forEach((edge) =>{
        //console.log(JSON.stringify(edge));
        let a = edge.from;
        let b = edge.to;
        dagreGraph.setEdge(a, b);
    });

    dagreGraph.edges().forEach(function(e) {
    console.log("Edge " + e.v + " -> " + e.w + ": " + JSON.stringify(dagreGraph.edge(e)));
    });

    dagre.layout(dagreGraph);

    // We are shifting the dagre node position (anchor=center center) to the top left
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


function computeNodePositions(nodes, edges){
    const dagreGraph = new dagre.graphlib.Graph();
        // Set an object for the graph label
    g.setGraph({});

        // Default to assigning a new object as a label for each new edge.
    g.setDefaultEdgeLabel(function() { return {}; });
    nodes.forEach((node)=>{
        dagreGraph.setNode(node.id, {label: node.id, width: node.width, height: node.height});
    });
    edges.forEach((edge) =>{
        //console.log(JSON.stringify(edge));
        dagreGraph.setEdge(edge.fromNode.id, edge.toNode.id);
    });

    dagreGraph.edges().forEach(function(e) {
    console.log("Edge " + e.v + " -> " + e.w + ": " + JSON.stringify(dagreGraph.edge(e)));
    });

    dagre.layout(dagreGraph);

    // We are shifting the dagre node position (anchor=center center) to the top left
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


function printAGraph(){

    // Create a new directed graph 
    var g = new dagre.graphlib.Graph();

    // Set an object for the graph label
    g.setGraph({});

    // Default to assigning a new object as a label for each new edge.
    g.setDefaultEdgeLabel(function() { return {}; });

    // Add nodes to the graph. The first argument is the node id. The second is
    // metadata about the node. In this case we're going to add labels to each of
    // our nodes.
    g.setNode("kspacey",    { label: "Kevin Spacey",  width: 144, height: 100 });
    g.setNode("swilliams",  { label: "Saul Williams", width: 160, height: 100 });
    g.setNode("bpitt",      { label: "Brad Pitt",     width: 108, height: 100 });
    g.setNode("hford",      { label: "Harrison Ford", width: 168, height: 100 });
    g.setNode("lwilson",    { label: "Luke Wilson",   width: 144, height: 100 });
    g.setNode("kbacon",     { label: "Kevin Bacon",   width: 121, height: 100 });

    // Add edges to the graph.
    g.setEdge("kspacey",   "swilliams");
    g.setEdge("swilliams", "kbacon");
    g.setEdge("bpitt",     "kbacon");
    g.setEdge("hford",     "lwilson");
    g.setEdge("lwilson",   "kbacon");


    //Layout nodes and edges. 
    dagre.layout(g);

    g.nodes().forEach(function(v) {
        console.log("Node " + v + ": " + JSON.stringify(g.node(v)));
    });
    g.edges().forEach(function(e) {
    console.log("Edge " + e.v + " -> " + e.w + ": " + JSON.stringify(g.edge(e)));
    });
}
  
class DataObjectsAndActions extends DAGraph{
    constructor(jsonObject){
        const dataObjects = getDataObjects(jsonObject.dataObjects);
        const actions = getActions(jsonObject.actions, dataObjects);
        //const dataObjectsWithPosition: DataObject[] = computeNodePositions(dataObjects, actions) as DataObject[]; //Downcasting because the function returns a Node[]
        super(dataObjects, actions);
        this.jsonObject = jsonObject;
    }
  }










const n1 = new Node("1")
const n2 = new Node("2")
const n3 = new Node("3")
const n4 = new Node("4")
const n5 = new Node("5")
const n6 = new Node("6")
const n7 = new Node("7")
const n8 = new Node("8")
const n9 = new Node("9")

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

//printAGraph();
const result = computeNodePositions2(g.nodes);

console.log(g.longestPath(g.nodes[8]))
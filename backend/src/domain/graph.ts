/**
 * The lineage graph, ported from src/util/ConfigExplorer/Graphs.ts of the frontend.
 *
 * Only the graph model travels: the layout helpers (dagre) and the ReactFlow
 * conversions stay in the browser, because the server never lays anything out.
 * What is left is the part tests/graph.test.ts covers, and it must keep answering
 * exactly what the config explorer answers - see test/unit.
 */

export enum NodeType {
  DataNode,
  ActionNode,
  CommonNode,
}

export class Node {
  public id: string;
  public nodeType: NodeType;

  constructor(id: string, nodeType: NodeType = NodeType.CommonNode) {
    this.id = id;
    this.nodeType = nodeType;
  }
}

export class Edge {
  public fromNode: Node;
  public toNode: Node;
  public id: string;
  public source: string;
  public target: string;
  public type?: string;
  /**
   * The data object this edge stands for, when data objects are not nodes of the graph.
   * Set by getActionGraph, where an edge between two actions is the data object they share.
   */
  public dataObjectId?: string;

  constructor(fromNode: Node, toNode: Node, id: string, type?: string, dataObjectId?: string) {
    this.fromNode = fromNode;
    this.toNode = toNode;
    this.id = id;
    this.source = fromNode.id;
    this.target = toNode.id;
    this.type = type;
    this.dataObjectId = dataObjectId;
  }
}

export class DataObject extends Node {
  public jsonObject?: any;

  constructor(id: string, jsonObject?: any) {
    super(id, NodeType.DataNode);
    this.jsonObject = jsonObject;
  }
}

export class ActionObject extends Node {
  public jsonObject?: any;
  public fromNodes: Node[];
  public toNodes: Node[];

  constructor(fromNodes: Node[], toNodes: Node[], id: string, jsonObject?: any) {
    super(id, NodeType.ActionNode);
    this.jsonObject = jsonObject;
    this.fromNodes = fromNodes;
    this.toNodes = toNodes;
  }

  getActionType(): string {
    return this.jsonObject ? this.jsonObject.type : 'AnyType';
  }
}

export type Direction = 'forward' | 'backward';

export class DAGraph {
  public nodes: Node[];
  public edges: Edge[];

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  getNodeById(id: string): Node | undefined {
    return this.nodes.find((node) => node.id === id);
  }

  getEdgeById(id: string): Edge | undefined {
    return this.edges.find((edge) => edge.id === id);
  }

  /** Nodes with no incoming edge. */
  getSourceNodes(): Node[] {
    return this.nodes.filter((n) => !this.edges.some((e) => e.toNode.id === n.id));
  }

  /** Nodes with no outgoing edge. */
  getSinkNodes(): Node[] {
    return this.nodes.filter((n) => !this.edges.some((e) => e.fromNode.id === n.id));
  }

  /** Everything reachable from a node, excluding the node itself. */
  getDescendants(node: Node, maxDepth = Infinity): Node[] {
    return this.traverse(node, 'forward', maxDepth);
  }

  /** Everything that reaches a node, excluding the node itself. */
  getAncestors(node: Node, maxDepth = Infinity): Node[] {
    return this.traverse(node, 'backward', maxDepth);
  }

  private traverse(start: Node, direction: Direction, maxDepth: number): Node[] {
    const visited = new Map<string, Node>();
    let frontier: Node[] = [start];
    let depth = 0;
    while (frontier.length > 0 && depth < maxDepth) {
      const next: Node[] = [];
      for (const node of frontier) {
        const edges =
          direction === 'forward'
            ? this.edges.filter((e) => e.fromNode.id === node.id)
            : this.edges.filter((e) => e.toNode.id === node.id);
        for (const edge of edges) {
          const neighbour = direction === 'forward' ? edge.toNode : edge.fromNode;
          if (neighbour.id !== start.id && !visited.has(neighbour.id)) {
            visited.set(neighbour.id, neighbour);
            next.push(neighbour);
          }
        }
      }
      frontier = next;
      depth += 1;
    }
    return [...visited.values()];
  }

  /** The immediate neighbours of a node in one direction. */
  getDirectNeighbours(node: Node, direction: Direction): Node[] {
    return direction === 'forward'
      ? this.edges.filter((e) => e.fromNode.id === node.id).map((e) => e.toNode)
      : this.edges.filter((e) => e.toNode.id === node.id).map((e) => e.fromNode);
  }

  /** A new graph with data objects as nodes, collapsing each action into edges. */
  getDataGraph(): DAGraph {
    const newEdges = new Map<string, Edge>();
    const newNodes = this.nodes.filter((node) => node.nodeType === NodeType.DataNode);

    for (const action of this.nodes.filter((n) => n.nodeType === NodeType.ActionNode)) {
      const inEdges = this.edges.filter((e) => e.toNode.id === action.id);
      const outEdges = this.edges.filter((e) => e.fromNode.id === action.id);
      for (const inEdge of inEdges) {
        for (const outEdge of outEdges) {
          const connection = `${inEdge.fromNode.id}->${outEdge.toNode.id}`;
          if (!newEdges.has(connection)) {
            newEdges.set(
              connection,
              new Edge(
                inEdge.fromNode,
                outEdge.toNode,
                `${inEdge.fromNode.id}->${action.id}->${outEdge.toNode.id}`,
              ),
            );
          }
        }
      }
    }
    return new DAGraph(newNodes, [...newEdges.values()]);
  }

  /**
   * A new graph with actions as nodes, where every edge is the data object two
   * actions share - so two actions sharing several data objects get one edge each.
   * An action that reads and writes the same data object (the historization pattern)
   * would be its own successor; such an edge says nothing and is left out.
   */
  getActionGraph(): DAGraph {
    const actions = this.nodes.filter(
      (node) => node.nodeType === NodeType.ActionNode,
    ) as ActionObject[];
    const newEdges: Edge[] = [];

    for (const action of actions) {
      const actionType = action.getActionType();
      for (const via of action.toNodes) {
        for (const edge of this.edges.filter((e) => e.fromNode.id === via.id)) {
          const toAction = edge.toNode as ActionObject;
          if (toAction.id === action.id) continue;
          newEdges.push(
            new Edge(action, toAction, `${action.id}->${via.id}->${toAction.id}`, actionType, via.id),
          );
        }
      }
    }
    return new DAGraph(actions, newEdges);
  }

  /** The subgraph induced by a set of node ids. */
  getSubGraph(nodeIds: string[]): DAGraph {
    const ids = new Set(nodeIds);
    return new DAGraph(
      this.nodes.filter((node) => ids.has(node.id)),
      this.edges.filter((edge) => ids.has(edge.fromNode.id) && ids.has(edge.toNode.id)),
    );
  }

  /**
   * The neighbourhood of one node: everything upstream and downstream of it up to
   * a depth, plus the node itself. This is what get_lineage answers with.
   */
  getNeighbourhood(nodeId: string, direction: 'upstream' | 'downstream' | 'both', depth: number): DAGraph {
    const node = this.getNodeById(nodeId);
    if (!node) return new DAGraph([], []);
    const ids = new Set<string>([nodeId]);
    if (direction !== 'downstream') this.getAncestors(node, depth).forEach((n) => ids.add(n.id));
    if (direction !== 'upstream') this.getDescendants(node, depth).forEach((n) => ids.add(n.id));
    return this.getSubGraph([...ids]);
  }
}

/**
 * The ids an action reads and writes, covering every spelling SDLB allows:
 * inputId/outputId for the 1:1 actions, inputIds/outputIds for the n-ary ones,
 * and mlflowId, which the MLflow actions use instead.
 */
export function actionIds(action: any): { inputIds: string[]; outputIds: string[] } {
  const inputIds: string[] = [];
  const outputIds: string[] = [];
  if (action.inputIds) inputIds.push(...action.inputIds);
  if (action.outputIds) outputIds.push(...action.outputIds);
  if (action.inputId) inputIds.push(action.inputId);
  if (action.outputId) outputIds.push(action.outputId);
  if (action.type === 'MLflowPredictAction' && action.mlflowId) inputIds.push(action.mlflowId);
  if (action.type === 'MLflowTrainAction' && action.mlflowId) outputIds.push(action.mlflowId);
  return { inputIds, outputIds };
}

/**
 * The full graph of a configuration, with both data objects and actions as nodes.
 * The equivalent of DataObjectsAndActionsSep, minus the layout pass.
 *
 * An action naming a data object that does not exist is skipped rather than fatal:
 * a configuration can be uploaded while it is still being written, and one broken
 * action should not cost the caller the whole lineage.
 */
export function buildFullGraph(config: {
  dataObjects?: Record<string, any>;
  actions?: Record<string, any>;
}): { graph: DAGraph; skipped: { actionId: string; reason: string }[] } {
  const dataObjects = Object.entries(config.dataObjects ?? {}).map(
    ([id, json]) => new DataObject(id, json),
  );
  const byId = new Map(dataObjects.map((d) => [d.id, d]));

  const actionNodes: ActionObject[] = [];
  const edges: Edge[] = [];
  const skipped: { actionId: string; reason: string }[] = [];

  for (const [actionId, action] of Object.entries(config.actions ?? {})) {
    const { inputIds, outputIds } = actionIds(action);
    const missing = [...inputIds, ...outputIds].filter((id) => !byId.has(id));
    if (missing.length > 0) {
      skipped.push({ actionId, reason: `unknown data object(s): ${missing.join(', ')}` });
      continue;
    }
    const actionObject = new ActionObject(
      inputIds.map((id) => byId.get(id)!),
      outputIds.map((id) => byId.get(id)!),
      actionId,
      action,
    );
    inputIds.forEach((id) =>
      edges.push(new Edge(byId.get(id)!, actionObject, `${actionId}_from_${id}`)),
    );
    outputIds.forEach((id) =>
      edges.push(new Edge(actionObject, byId.get(id)!, `${actionId}_to_${id}`)),
    );
    actionNodes.push(actionObject);
  }

  return { graph: new DAGraph([...dataObjects, ...actionNodes], edges), skipped };
}

/**
 * The action graph of one run, built from the state file's inputIds/outputIds rather
 * than from the configuration. The equivalent of util/WorkflowsExplorer/Lineage.ts.
 */
export function buildRunGraph(
  actions: { action: string; inputIds: string[]; outputIds: string[] }[],
): DAGraph {
  const dataObjects = new Map<string, DataObject>();
  const ensure = (id: string) => {
    let node = dataObjects.get(id);
    if (!node) {
      node = new DataObject(id);
      dataObjects.set(id, node);
    }
    return node;
  };

  const actionNodes: ActionObject[] = [];
  const edges: Edge[] = [];
  for (const { action, inputIds, outputIds } of actions) {
    const actionObject = new ActionObject(
      inputIds.map(ensure),
      outputIds.map(ensure),
      action,
    );
    inputIds.forEach((id) => edges.push(new Edge(ensure(id), actionObject, `${action}_from_${id}`)));
    outputIds.forEach((id) => edges.push(new Edge(actionObject, ensure(id), `${action}_to_${id}`)));
    actionNodes.push(actionObject);
  }
  return new DAGraph([...dataObjects.values(), ...actionNodes], edges);
}

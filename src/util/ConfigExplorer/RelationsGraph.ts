import { ConfigData } from "./ConfigData";
import { ForeignKeyConfig, IncomingRef, getForeignKeys } from "./ColumnModel";
import { DAGraph, Edge, Node, NodeType } from "./Graphs";

/*
    The relations graph: DataObjects as nodes, their declared foreign keys as edges.

    This is the model behind the Entity Relation Diagram. Unlike the lineage graphs it is not
    derived from the actions - two DataObjects can be related without any action connecting them,
    and two DataObjects an action connects need not be related - so it is built directly from
    `table.foreignKeys`, next to fullGraph/dataGraph/actionGraph in ConfigData.

    A foreign key names the DataObject it references (`dataObjectId`), so an edge is a lookup rather
    than a resolution; a key still written in the pre 3.x `db`/`table` form names no DataObject and
    is dropped by getForeignKeys.

    It is a DAGraph so that everything the lineage tab already does - centering, expanding,
    collapsing, grouping, layouting - works on it unchanged. It is *not* acyclic though: foreign
    keys point in circles often enough that every traversal used on it has to tolerate that.
*/

/** An edge of the relations graph: one declared foreign key. */
export class RelationEdge extends Edge {
    public fkName?: string;
    /** the column pairs of the foreign key, lowercased, in declaration order */
    public columns: {from: string, to: string}[];

    constructor(fromNode: Node, toNode: Node, id: string, columns: {from: string, to: string}[], fkName?: string) {
        super(fromNode, toNode, id, 'foreignKey');
        this.columns = columns;
        this.fkName = fkName;
    }
}

/**
 * Whether a foreign key's `dataObjectId` names a DataObject of this configuration.
 *
 * It need not: SDLB rejects an unknown id, but the explorer is regularly shown a configuration
 * narrowed by a feed selection, and a key out of that selection keeps its reference and renders as
 * unresolved rather than disappearing.
 */
export function isKnownDataObject(dataObjectId: string, configData: ConfigData): boolean {
    return configData.dataObjects?.[dataObjectId] !== undefined;
}

const columnPairs = (fk: ForeignKeyConfig) =>
    Object.entries(fk.columns).map(([from, to]) => ({from: from.toLowerCase(), to: String(to).toLowerCase()}));

/**
 * Build the relations graph from the DataObject nodes of the full graph.
 *
 * The nodes are the very same DataObject instances the other graphs use, so that node identity,
 * and with it the configuration behind a node, is shared across the views.
 */
export function getRelationsGraph(fullGraph: DAGraph, configData: ConfigData): DAGraph {
    const nodes = fullGraph.nodes.filter(node => node.nodeType === NodeType.DataNode);
    const nodesById = new Map(nodes.map(node => [node.id, node]));
    const edges: RelationEdge[] = [];

    nodes.forEach(node => {
        const configObj = configData.dataObjects?.[node.id];
        getForeignKeys(configObj).forEach((fk, i) => {
            const targetNode = nodesById.get(fk.dataObjectId);
            if (!targetNode) {
                // the foreign key points at a DataObject this configuration does not describe. The
                // column keeps the reference (see buildColumnModel) and renders it as unresolved.
                console.debug(`Foreign key of '${node.id}' points at '${fk.dataObjectId}', which is not a DataObject of this configuration`);
                return;
            }
            // the foreign key name is part of the id, so that two foreign keys between the same
            // pair of DataObjects are two edges rather than duplicate ids
            edges.push(new RelationEdge(node, targetNode, `${node.id}-fk:${fk.name ?? i}->${targetNode.id}`,
                                        columnPairs(fk), fk.name));
        });
    });

    return new DAGraph(nodes, edges);
}

/**
 * The foreign keys of other DataObjects pointing at the given one, per referenced column.
 *
 * The referenced side of a relation needs this: its column carries an edge handle, and it is not
 * necessarily a primary key, so nothing else would put it into the column model.
 */
export function getIncomingRefs(dataObjectId: string, relationsGraph: DAGraph | undefined): IncomingRef[] {
    if (!relationsGraph) return [];
    const result: IncomingRef[] = [];
    relationsGraph.edges.forEach(edge => {
        if (edge.toNode.id !== dataObjectId) return;
        (edge as RelationEdge).columns?.forEach(({from, to}) => {
            result.push({column: to, dataObjectId: edge.fromNode.id, fromColumn: from, fkName: (edge as RelationEdge).fkName});
        });
    });
    return result;
}

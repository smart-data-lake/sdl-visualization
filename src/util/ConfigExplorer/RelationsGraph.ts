import { ConfigData } from "./ConfigData";
import { ForeignKeyConfig, IncomingRef, getForeignKeys } from "./ColumnModel";
import { DAGraph, Edge, Node, NodeType } from "./Graphs";

/*
    The relations graph: DataObjects as nodes, their declared foreign keys as edges.

    This is the model behind the Entity Relation Diagram. Unlike the lineage graphs it is not
    derived from the actions - two DataObjects can be related without any action connecting them,
    and two DataObjects an action connects need not be related - so it is built directly from
    `table.foreignKeys`, next to fullGraph/dataGraph/actionGraph in ConfigData.

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

/** Where a DataObject's table lives, filling the gaps from its connection. */
export function tableCoordinates(configObj: any, configData: ConfigData): {catalog?: string, db?: string, name?: string} {
    const table = configObj?.table;
    if (!table || typeof table.name !== 'string') return {};
    // db and catalog may be declared on the connection instead of on the table, the same fallback
    // the Configuration tab and the Foreign Keys accordion use
    const connection = configObj?.connectionId ? configData.connections?.[configObj.connectionId] : undefined;
    return {
        catalog: table.catalog ?? connection?.catalog,
        db: table.db ?? connection?.db,
        name: table.name,
    };
}

/*
    An index from table name to DataObject id, so that a foreign key - which names a table, not a
    DataObject - can be resolved. Every table is registered under its fully qualified name, under
    db.name and under its bare name, so that a foreign key can be as unspecific as it likes. A key
    two tables would claim is ambiguous and registered for neither.
*/
export function buildTableIndex(configData: ConfigData): Map<string, string> {
    const index = new Map<string, string>();
    const ambiguous = new Set<string>();
    const register = (key: string | undefined, dataObjectId: string) => {
        if (!key) return;
        const lower = key.toLowerCase();
        if (ambiguous.has(lower)) return;
        const existing = index.get(lower);
        if (existing === undefined) index.set(lower, dataObjectId);
        else if (existing !== dataObjectId) { index.delete(lower); ambiguous.add(lower); }
    };

    Object.entries(configData.dataObjects ?? {}).forEach(([dataObjectId, configObj]) => {
        const {catalog, db, name} = tableCoordinates(configObj, configData);
        if (!name) return;
        if (catalog && db) register(`${catalog}.${db}.${name}`, dataObjectId);
        if (db) register(`${db}.${name}`, dataObjectId);
        register(name, dataObjectId);
    });
    return index;
}

/**
 * The id of the DataObject a foreign key points at, or undefined when it points outside this
 * configuration - which is legitimate, not an error.
 *
 * Tried from the most specific name to the least: the foreign key may name a db of its own, else
 * it is read as living in the same db as the DataObject that declares it.
 */
export function resolveFkTarget(fk: ForeignKeyConfig,
                                configObj: any,
                                configData: ConfigData,
                                index: Map<string, string> = buildTableIndex(configData)): string | undefined {
    const own = tableCoordinates(configObj, configData);
    const db = fk.db ?? own.db;
    const candidates = [
        own.catalog && db ? `${own.catalog}.${db}.${fk.table}` : undefined,
        db ? `${db}.${fk.table}` : undefined,
        fk.table,
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const dataObjectId = index.get(candidate.toLowerCase());
        if (dataObjectId) return dataObjectId;
    }
    return undefined;
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
    const index = buildTableIndex(configData);
    const edges: RelationEdge[] = [];

    nodes.forEach(node => {
        const configObj = configData.dataObjects?.[node.id];
        getForeignKeys(configObj).forEach((fk, i) => {
            const targetId = resolveFkTarget(fk, configObj, configData, index);
            const targetNode = targetId ? nodesById.get(targetId) : undefined;
            if (!targetNode) {
                // the foreign key points at a table this configuration does not describe. The
                // column keeps the reference (see buildColumnModel) and renders it as unresolved.
                console.debug(`Foreign key of '${node.id}' points at '${fk.table}', which is not a DataObject of this configuration`);
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

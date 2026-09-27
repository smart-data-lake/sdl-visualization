import { ColumnLineage, ColumnTransformation, columnKey } from './columnLineage';

/*
    The ports of an expanded action node in the full view: one per input column the action reads,
    one per output column it writes, and the connections between them - all from the column lineage
    of the data objects it writes, which is where SDLB records what an action does to columns.
*/

export interface Port {
    dataObjectId: string;
    /** as exported */
    column: string;
    /** `${dataObjectId}.${columnKey(column)}`, unique within the action - see portHandleId */
    key: string;
}

export interface OutputPort extends Port {
    /** what creates a column without input columns */
    expression?: string;
    /** SDLB could not trace the column back */
    unresolved?: boolean;
}

export interface PortConnection {
    from: string;
    to: string;
    transformations: ColumnTransformation[];
}

/** A row of one side of the node: the data object the ports below it belong to, or a port. */
export type PortRow = {caption: string} | {port: Port | OutputPort};

export interface ActionPorts {
    inputs: Port[];
    outputs: OutputPort[];
    connections: PortConnection[];
    inputRows: PortRow[];
    outputRows: PortRow[];
}

export const portKey = (dataObjectId: string, column: string) => `${dataObjectId}.${columnKey(column)}`;

/** How the ports of one side are ordered, so that they line up with the data objects they connect to. */
export interface PortOrder {
    /** a data object's columns in the order its node lists them, i.e. its exported schema */
    columnsOf?: (dataObjectId: string) => string[] | undefined;
    /** where a data object's group goes on one side, from the placement in the layout, see portGroupRanks */
    groupRankOf?: (dataObjectId: string, side: 'input' | 'output') => number | undefined;
}

/** Groups by rank, columns by schema position; whatever is unknown keeps first appearance, last - as buildColumnModel appends it. */
function sortPorts<P extends Port>(ports: P[], side: 'input' | 'output', order: PortOrder): P[] {
    const firstAppearance = new Map<string, number>();
    ports.forEach(port => { if (!firstAppearance.has(port.dataObjectId)) firstAppearance.set(port.dataObjectId, firstAppearance.size); });
    const positions = new Map<string, Map<string, number>>();
    const positionOf = (port: Port) => {
        let byColumn = positions.get(port.dataObjectId);
        if (!byColumn) {
            byColumn = new Map((order.columnsOf?.(port.dataObjectId) ?? []).map((column, i) => [columnKey(column), i]));
            positions.set(port.dataObjectId, byColumn);
        }
        return byColumn.get(columnKey(port.column)) ?? Number.MAX_SAFE_INTEGER;
    };
    const rankOf = (dataObjectId: string) => order.groupRankOf?.(dataObjectId, side) ?? Number.MAX_SAFE_INTEGER;
    return [...ports].sort((a, b) =>
        rankOf(a.dataObjectId) - rankOf(b.dataObjectId)
        || firstAppearance.get(a.dataObjectId)! - firstAppearance.get(b.dataObjectId)!
        || positionOf(a) - positionOf(b));
}

/** The rows of one side: its ports grouped under the data object they belong to, in first appearance. */
function rowsOf(ports: Port[]): PortRow[] {
    const byDataObject = new Map<string, Port[]>();
    ports.forEach(port => byDataObject.set(port.dataObjectId, [...(byDataObject.get(port.dataObjectId) ?? []), port]));
    return [...byDataObject].flatMap(([dataObjectId, group]) => [{caption: dataObjectId}, ...group.map(port => ({port}))]);
}

export function buildActionPorts(actionId: string, lineage: ColumnLineage[], order: PortOrder = {}): ActionPorts {
    const inputs = new Map<string, Port>();
    const outputs = new Map<string, OutputPort>();
    const connections: PortConnection[] = [];
    lineage.filter(doc => doc.actionId === actionId).forEach(doc => {
        doc.fields.forEach(field => {
            const to = portKey(doc.dataObjectId, field.column);
            if (!outputs.has(to)) outputs.set(to, {dataObjectId: doc.dataObjectId, column: field.column, key: to, expression: field.expression});
            field.inputs.forEach(input => {
                const from = portKey(input.dataObjectId, input.column);
                if (!inputs.has(from)) inputs.set(from, {dataObjectId: input.dataObjectId, column: input.column, key: from});
                connections.push({from, to, transformations: input.transformations});
            });
        });
        doc.unresolved.forEach(column => {
            const key = portKey(doc.dataObjectId, column);
            if (!outputs.has(key)) outputs.set(key, {dataObjectId: doc.dataObjectId, column, key, unresolved: true});
        });
    });
    const inputList = sortPorts([...inputs.values()], 'input', order), outputList = sortPorts([...outputs.values()], 'output', order);
    return {inputs: inputList, outputs: outputList, connections, inputRows: rowsOf(inputList), outputRows: rowsOf(outputList)};
}

/** How many rows the taller side has, which is what the node's height is laid out for. */
export const portRowCount = (ports: ActionPorts | undefined) =>
    ports ? Math.max(ports.inputRows.length, ports.outputRows.length) : 0;

/** The connection keys of a trace within one action, see traceHighlights. */
export const connectionKey = (from: string, to: string) => `${from}>${to}`;

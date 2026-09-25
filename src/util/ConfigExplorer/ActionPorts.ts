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

/** The rows of one side: its ports grouped under the data object they belong to, in first appearance. */
function rowsOf(ports: Port[]): PortRow[] {
    const byDataObject = new Map<string, Port[]>();
    ports.forEach(port => byDataObject.set(port.dataObjectId, [...(byDataObject.get(port.dataObjectId) ?? []), port]));
    return [...byDataObject].flatMap(([dataObjectId, group]) => [{caption: dataObjectId}, ...group.map(port => ({port}))]);
}

export function buildActionPorts(actionId: string, lineage: ColumnLineage[]): ActionPorts {
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
    const inputList = [...inputs.values()], outputList = [...outputs.values()];
    return {inputs: inputList, outputs: outputList, connections, inputRows: rowsOf(inputList), outputRows: rowsOf(outputList)};
}

/** How many rows the taller side has, which is what the node's height is laid out for. */
export const portRowCount = (ports: ActionPorts | undefined) =>
    ports ? Math.max(ports.inputRows.length, ports.outputRows.length) : 0;

/** The connection keys of a trace within one action, see traceHighlights. */
export const connectionKey = (from: string, to: string) => `${from}>${to}`;

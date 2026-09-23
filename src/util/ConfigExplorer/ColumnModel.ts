import { SchemaColumn, SchemaData } from "../../types";

/*
    The columns of a DataObject, merged from the two places the app knows about them.

    The configuration declares the *keys*: `table.primaryKey` and `table.foreignKeys`. They are
    always available, synchronously, from the parsed config.

    The DataObjectSchemaExporter writes the *runtime schema* as a separate artifact, fetched per
    DataObject (see useFetchDataObjectSchema). It has every column and its type, but only exists
    where the exporter has run - and a failed export carries an error message instead of columns.

    So the merged list is "everything the schema knows" plus "every column a key names", and a
    column the keys name but the schema does not is marked declaredOnly. That union is not cosmetic:
    the lineage graph draws relation edges onto per-column handles, and ReactFlow silently drops an
    edge whose handle does not exist.
*/

/**
 * One entry of a DataObject's `table.foreignKeys`.
 *
 * A foreign key names the DataObject it references, not its table: SDLB 3.x replaced the former
 * `db`/`table` pair with `dataObjectId` (smart-data-lake#1148) and resolves the referenced table
 * from that DataObject. An entry still written the old way is ignored - see getForeignKeys.
 */
export interface ForeignKeyConfig {
    name?: string;
    dataObjectId: string;
    /*
        The column mapping, read as {own column: referenced column} - the direction the Foreign Keys
        accordion renders it in (ConfigurationAccordions), and the only direction that makes sense
        for a key declared on the referencing table. If SDLB ever means it the other way round, this
        is the one place to flip.
    */
    columns: Record<string, string>;
}

/** Where a foreign key points. */
export interface ColumnRef {
    /** the DataObject the foreign key names, whether or not this configuration describes it */
    dataObjectId: string;
    column: string;
    fkName?: string;
    /**
     * Whether `dataObjectId` is a DataObject of this configuration. It need not be: the explorer is
     * regularly shown a configuration narrowed by a feed selection, and SDLB itself only warns when
     * a referenced DataObject was filtered away.
     */
    resolved: boolean;
}

/**
 * A foreign key of another DataObject pointing at a column of this one - the referenced side of a
 * relation. It has to be part of the model because that column carries an edge handle too, and
 * because a referenced column is not necessarily a primary key.
 */
export interface IncomingRef {
    /** the column of *this* DataObject that is referenced */
    column: string;
    /** the DataObject whose foreign key points here */
    dataObjectId: string;
    /** the column of that DataObject */
    fromColumn: string;
    fkName?: string;
}

export interface ColumnInfo {
    /** the name as it is rendered */
    name: string;
    /** name.toLowerCase() - used for handle ids and for every comparison, see matching below */
    key: string;
    dataType?: string;
    description?: string;
    isPrimaryKey: boolean;
    /** the foreign keys this column is the referencing side of */
    references: ColumnRef[];
    /** the foreign keys of other DataObjects that point at this column */
    referencedBy: IncomingRef[];
    /**
     * Named by a key but absent from the exported schema - a column the configuration believes in
     * and the data does not have. Only ever set where there *is* an exported schema to be absent
     * from; without one every column would be declaredOnly, which says nothing.
     */
    declaredOnly: boolean;
}

export interface DataObjectColumns {
    columns: ColumnInfo[];
    /** which of the two sources the list came from, for the empty and loading states */
    source: 'none' | 'keys' | 'exported' | 'merged';
}

/**
 * How much of a data object's columns a node shows. It steps: nothing, the columns a key names,
 * every column - which is what the expand control on the node walks through.
 */
export type ColumnDisplay = 'none' | 'keys' | 'all';

/** the display one step further open, and one step further closed */
export const moreColumns = (display: ColumnDisplay): ColumnDisplay => display === 'none' ? 'keys' : 'all';
export const lessColumns = (display: ColumnDisplay): ColumnDisplay => display === 'all' ? 'keys' : 'none';

export const emptyColumns: DataObjectColumns = { columns: [], source: 'none' };

/*
    Column names are matched case insensitively throughout. SDLB configurations name key columns as
    they are written in the HOCON (`primaryKey = [ident]`) while the exported schema carries the
    case the storage layer reports, and the two do not have to agree.
*/
const keyOf = (name: string) => name.toLowerCase();

/**
 * The `table.foreignKeys` of a DataObject configuration, defensively.
 *
 * An entry without a `dataObjectId` is dropped, which is also how a key in the pre 3.x `db`/`table`
 * form is ignored: the table it names cannot be resolved to a DataObject without guessing, and a
 * wrong relation is worse than none.
 */
export function getForeignKeys(configObj: any): ForeignKeyConfig[] {
    const foreignKeys = configObj?.table?.foreignKeys;
    if (!Array.isArray(foreignKeys)) return [];
    return foreignKeys.filter(fk => fk && typeof fk === 'object' && typeof fk.dataObjectId === 'string'
                                    && fk.columns && typeof fk.columns === 'object');
}

/**
 * Whether `dataObjectId` names a DataObject of the configuration - which is what decides whether a
 * foreign key leads anywhere. It need not: SDLB rejects an unknown id, but the explorer is regularly
 * shown a configuration narrowed by a feed selection, and a key out of that selection keeps its
 * reference and renders as unresolved rather than disappearing.
 *
 * @param dataObjects ConfigData.dataObjects. Undefined means the caller has no configuration to
 *                    check against at all, and the reference is taken as given rather than reported
 *                    as unresolved - saying "not in this configuration" needs a configuration.
 */
export function isKnownDataObject(dataObjects: any, dataObjectId: string): boolean {
    return !dataObjects || dataObjects[dataObjectId] !== undefined;
}

/** The `table.primaryKey` of a DataObject configuration, defensively. */
export function getPrimaryKey(configObj: any): string[] {
    const primaryKey = configObj?.table?.primaryKey;
    if (!Array.isArray(primaryKey)) return [];
    return primaryKey.filter(col => typeof col === 'string');
}

/*
    The top level columns of an exported schema.

    Only the top level: a nested struct field cannot carry a foreign key, and unfolding one would
    make a node arbitrarily tall. The Schema tab flattens the whole tree instead, which is the right
    thing for a table and the wrong thing for a graph node.
*/
export function getExportedColumns(schemaData: SchemaData | undefined): {name: string, dataType?: string, comment?: string}[] {
    if (!schemaData?.schema || !Array.isArray(schemaData.schema)) return [];
    return schemaData.schema
        .filter((column: SchemaColumn) => column && typeof column.name === 'string')
        .map((column: SchemaColumn) => ({
            name: column.name,
            dataType: typeof column.dataType === 'string' ? column.dataType : column.dataType?.dataType,
            comment: column.comment,
        }));
}

export interface ColumnModelOptions {
    /** the newest exported schema, if one has been fetched */
    schema?: SchemaData;
    /**
     * Whether a referenced DataObject id is one this configuration describes. Without it nothing can
     * be told apart from a reference leaving the configuration, so every reference stays unresolved.
     */
    isKnownDataObject?: (dataObjectId: string) => boolean;
    /** the foreign keys of other DataObjects pointing at this one, see RelationsGraph */
    referencedBy?: IncomingRef[];
}

/**
 * Merge what the configuration declares about a DataObject's columns with its exported schema.
 *
 * @param configObj the DataObject's configuration, as it sits in ConfigData.dataObjects
 */
export function buildColumnModel(configObj: any, options: ColumnModelOptions = {}): DataObjectColumns {
    const { schema: schemaData, isKnownDataObject, referencedBy = [] } = options;
    const exported = getExportedColumns(schemaData);
    const primaryKey = getPrimaryKey(configObj);
    const foreignKeys = getForeignKeys(configObj);

    // with nothing to compare against, "absent from the exported schema" is not a statement
    const hasExportedSchema = exported.length > 0;
    const columns: ColumnInfo[] = [];
    const byKey = new Map<string, ColumnInfo>();
    const add = (name: string, dataType: string | undefined, declaredOnly: boolean, description?: string) => {
        const key = keyOf(name);
        var column = byKey.get(key);
        if (!column) {
            column = {
                name, key, dataType,
                description,
                isPrimaryKey: false, references: [], referencedBy: [],
                declaredOnly: declaredOnly && hasExportedSchema,
            };
            byKey.set(key, column);
            columns.push(column);
        }
        return column;
    };

    // the exported schema first, so that the column order is the schema's
    exported.forEach(column => add(column.name, column.dataType, false, column.comment));

    primaryKey.forEach(name => { add(name, undefined, true).isPrimaryKey = true; });

    foreignKeys.forEach(fk => {
        const resolved = isKnownDataObject ? isKnownDataObject(fk.dataObjectId) : false;
        Object.entries(fk.columns).forEach(([ownColumn, referencedColumn]) => {
            add(ownColumn, undefined, true).references.push({
                dataObjectId: fk.dataObjectId, column: referencedColumn, fkName: fk.name, resolved,
            });
        });
    });

    referencedBy.forEach(incoming => add(incoming.column, undefined, true).referencedBy.push(incoming));

    const hasKeys = primaryKey.length > 0 || foreignKeys.length > 0 || referencedBy.length > 0;
    const source = exported.length > 0 ? (hasKeys ? 'merged' : 'exported')
                 : hasKeys ? 'keys'
                 : 'none';
    return { columns, source };
}

/**
 * The columns a node shows at the given display.
 *
 * At 'keys', both sides of a relation are kept, not only the referencing one: a relation edge is
 * drawn onto the handle of the referenced column too, and that column is not necessarily a primary
 * key of its own.
 */
export function filterColumns(columns: ColumnInfo[], display: ColumnDisplay): ColumnInfo[] {
    if (display === 'none') return [];
    if (display === 'all') return columns;
    return columns.filter(column => column.isPrimaryKey
                                 || column.references.length > 0
                                 || column.referencedBy.length > 0);
}

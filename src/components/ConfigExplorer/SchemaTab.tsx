import { Box, FormControl, FormLabel, Select, Sheet, Stack, Tooltip } from '@mui/joy';
import Option from '@mui/joy/Option';
import { useEffect, useMemo, useState } from 'react';
import { useFetchDataObjectSchema, useFetchDataObjectStats } from '../../hooks/useFetchData';
import { SchemaColumn, TstampEntry } from '../../types';
import { ColumnRef, getForeignKeys, getPrimaryKey, isKnownDataObject } from '../../util/ConfigExplorer/ColumnModel';
import { compareFunc, getPropertyByPath, onlyUnique } from '../../util/helpers';
import { formatTimestamp } from '../../util/WorkflowsExplorer/date';
import CenteredCircularProgress from '../Common/CenteredCircularProgress';
import { createDataObjectChip, createUnknownDataObjectChip } from './ConfigurationTab';
import DataTable, { nestedPropertyRenderer, tooltipCellRenderer } from './DataTable';
import { getMissingSchemaFileCmp } from './ElementDetails';
import InfoBox from './InfoBox';
import { PrimaryKeyIcon } from './LineageTab/ColumnIcons';

/**
 * Table cell renderer calculating a percentage value against a given base value
 */
export function percentageRenderer(baseValue: number|undefined, roundingPrecision: number = 1, invert: boolean = false) {
  const roundingFactor = Math.pow(10, roundingPrecision);
  return (prop: any) => {
      if (!baseValue) return undefined;
      const value = getPropertyByPath(prop.rowData, prop.column.key);
      if (value===undefined) return undefined;
      const fct = value / baseValue;
      const pct = Math.round((invert ? 1 - fct : fct) * 100 * roundingFactor) / roundingFactor;
      return <div>{pct.toString()}%</div>;
  }
}

/**
 * Table head cell renderer showing a tooltip with additional informations
 */
export function tooltipHeadRenderer(msg: string) {
  return (prop: any) => {
    return (
      <Tooltip arrow variant="soft" title={msg} enterDelay={500} enterNextDelay={500} placement='bottom-start'>
        <div>{prop.column.title}</div>
      </Tooltip>
    );
  }
}


/**
 * Table cell renderer showing a tooltip with cell content if content overflows
 */
/**
 * Table cell renderer marking a primary key column with the same symbol the graph node uses.
 *
 * A cell of a column that is not a key renders as empty rather than as undefined: the table falls
 * back to printing the raw value where a renderer returns nothing.
 */
export function primaryKeyRenderer() {
  // the flex box centres the symbol on the row, which a bare svg in a text cell is not
  return (prop: any) => (prop.rowData.isPrimaryKey
    ? <div style={{display: 'flex', alignItems: 'center', height: '100%'}}><PrimaryKeyIcon/></div>
    : <></>);
}

/**
 * Table cell renderer for the foreign keys a column is the referencing side of: a chip per
 * referenced DataObject, leading to its configuration, saying on hover which key leads there.
 *
 * A reference this configuration does not describe keeps its name but is not a link, as in the
 * Foreign Keys accordion and in the relations view.
 */
export function foreignKeyRenderer() {
  return (prop: any) => {
    const references: ColumnRef[] = prop.rowData.references ?? [];
    if (references.length === 0) return <></>;
    return (
      <Stack spacing={0.5} direction="row">
        {references.map((reference, idx) => {
          const title = `${reference.fkName ? reference.fkName + ': ' : ''}\u2192 ${reference.dataObjectId}.${reference.column}`
                      + (reference.resolved ? '' : ' (not in this configuration)');
          return reference.resolved ? createDataObjectChip(reference.dataObjectId, 'sm', {mr: 0}, idx, title)
                                    : createUnknownDataObjectChip(reference.dataObjectId, 'sm', {mr: 0}, idx, title);
        })}
      </Stack>
    );
  }
}

export default function SchemaTab(props: {elementType: string, elementName: string, schemaEntries: TstampEntry[] | undefined, statsEntries: TstampEntry[] | undefined, columnDescriptions: object|undefined, data?: any, dataObjects?: any}){

  // store the current schema entry to display
  const [schemaEntry, setSchemaEntry] = useState<TstampEntry>();

  // initialize schema entry if not yet set
  useEffect(() => {
    if (schemaEntry && !props.schemaEntries) {
      setSchemaEntry(undefined);
    } else if (props.schemaEntries && (!schemaEntry  || (schemaEntry && props.schemaEntries && props.schemaEntries.findIndex((e) => e.key == schemaEntry.key) < 0))) {
      setSchemaEntry(props.schemaEntries[0]);
    }
  }, [props.schemaEntries]);
  const { data: schema, isLoading: schemaIsLoading } = useFetchDataObjectSchema(schemaEntry);

  // store the current stats entry to display
  const [statsEntry, setStatsEntry] = useState<TstampEntry>();

  // initialize stats entry if not yet set
  useEffect(() => {
    if (statsEntry && !props.statsEntries) {
      setStatsEntry(undefined);
    } else if (props.statsEntries && (!statsEntry  || (statsEntry && props.statsEntries && props.statsEntries.findIndex((e) => e.key == statsEntry.key) < 0))) {
      setStatsEntry(props.statsEntries[0]);
    }
  }, [props.statsEntries]);
  const { data: stats } = useFetchDataObjectStats(statsEntry);

  /*
      What the configuration says about this DataObject's columns: which of them are the primary key
      and which ones reference another DataObject. Both are looked up by column name, lowercased -
      a configuration writes the name as it likes and the exported schema carries the case the
      storage layer reports (see ColumnModel).
  */
  const declaredKeys = useMemo(() => {
    const primaryKey = new Set(getPrimaryKey(props.data).map(name => name.toLowerCase()));
    const references = new Map<string, ColumnRef[]>();
    getForeignKeys(props.data).forEach(fk => {
      const resolved = isKnownDataObject(props.dataObjects, fk.dataObjectId);
      Object.entries(fk.columns).forEach(([ownColumn, referencedColumn]) => {
        const key = ownColumn.toLowerCase();
        const refs = references.get(key) ?? [];
        refs.push({dataObjectId: fk.dataObjectId, column: referencedColumn, fkName: fk.name, resolved});
        references.set(key, refs);
      });
    });
    return {primaryKey, references};
  }, [props.data, props.dataObjects]);

  // convert schema to rows for DataTable
  // rows must be numbered and reference parent row Id for nested data types.
  var currentId = 0; // variable to distribute unique id in tree
  function numberDataType(dataType: any, path: string, parentId: number): any[] {
    const rows: any[] = [];
    if (dataType?.dataType === 'struct') {
      // handle children
      const childRows = numberSchemaTree(dataType.fields, path, parentId);
      rows.push(...childRows);
    } else if (dataType?.dataType === 'array') {
      const currentPath = path+'.[]';
      const columnDescription = (props.columnDescriptions ? props.columnDescriptions[currentPath] as string : undefined);      
      // create entry
      const currentRow: any = {id: ++currentId, parentId: parentId, path: currentPath, name: '-element-', description: columnDescription, stats: {}}
      rows.push(currentRow)
      // handle children
      const childRows = numberDataType(dataType.elementType, currentPath, currentRow.id);
      currentRow.dataType = (childRows.length === 0 ? dataType.elementType : dataType.elementType.dataType);
      rows.push(...childRows);
    } else if (dataType?.dataType === 'map') {
      // handle key
      const keyCurrentPath = path+'.key';
      const keyColumnDescription = (props.columnDescriptions ? props.columnDescriptions[keyCurrentPath] as string : undefined);      
      // create key entry
      const keyCurrentRow: any = {id: ++currentId, parentId: parentId, path: keyCurrentPath, name: '-key-', description: keyColumnDescription, stats: {}}
      rows.push(keyCurrentRow)
      // handle key children
      const keyChildRows = numberDataType(dataType.elementType, keyCurrentPath, keyCurrentRow.id);
      keyCurrentRow.dataType = (keyChildRows.length === 0 ? dataType.keyType : dataType.keyType.dataType);
      rows.push(...keyChildRows);
      // handle value
      const valueCurrentPath = path+'.value';
      const valueColumnDescription = (props.columnDescriptions ? props.columnDescriptions[valueCurrentPath] as string : undefined);      
      // create value entry
      const valueCurrentRow: any = {id: ++currentId, parentId: parentId, path: valueCurrentPath, name: '-value-', description: valueColumnDescription, stats: {}}
      rows.push(valueCurrentRow)
      // handle value children
      const valueChildRows = numberDataType(dataType.elementType, valueCurrentPath, valueCurrentRow.id);
      valueCurrentRow.dataType = (valueChildRows.length === 0 ? dataType.valueType : dataType.valueType.dataType);
      rows.push(...valueChildRows);
    }
    return rows;
  }
  function numberSchemaTree(columns: SchemaColumn[], path: string|undefined = undefined, parentId: number|undefined = undefined): any[] {
    const rows: any[] = [];
    columns.map((column: any) => {
      const currentPath = (path ? path+'.'+column.name : column.name);      
      // consolidate column description (from description markdown) and comment from schema
      var columnDescription = (props.columnDescriptions ? props.columnDescriptions[currentPath] as string : undefined);      
      if (column.comment && columnDescription) columnDescription = columnDescription + '\n' + column.comment;
      else if (column.comment) columnDescription = column.comment;
      // look for column stats
      const colStats = (stats?.columns ? stats.columns[currentPath] : {}) || {};
      // create entry. Only a top level column can be a key - a foreign key on a nested struct field
      // is not a thing - and its path is its name, so the lookup is the same for both.
      const currentRow: any = {id: ++currentId, parentId: parentId, path: currentPath, name: column.name, description: columnDescription, stats: colStats,
                               isPrimaryKey: declaredKeys.primaryKey.has(currentPath.toLowerCase()),
                               references: declaredKeys.references.get(currentPath.toLowerCase()) ?? []};
      rows.push(currentRow);
      // handle children
      const childRows = numberDataType(column.dataType, currentPath, currentRow.id)
      currentRow.dataType = (childRows.length === 0 ? column.dataType : column.dataType.dataType);
      rows.push(...childRows);
    })
    return rows;
  } 
  const schemaRows = useMemo(() => (schema?.schema ? numberSchemaTree(schema.schema) : undefined), [props.elementName, schema, stats, declaredKeys]);

  /*
      The columns of the table. The two key columns are only offered where the configuration
      declares a key at all - on a DataObject without one they could only ever be empty.

      The foreign keys start hidden: they are a property of the data model rather than of the
      schema, and the column is wide. The column selection menu above the table turns it on, and
      remembers that (DataTable, useLocalStorageState).
  */
  const keyColumns: any[] = declaredKeys.primaryKey.size > 0 ? [{
    title: 'PK',
    property: 'isPrimaryKey',
    renderer: primaryKeyRenderer(),
    headRenderer: tooltipHeadRenderer("Primary key, as declared in table.primaryKey"),
    width: '40px',
    minWidth: 40
  }] : [];
  const foreignKeyColumns: any[] = declaredKeys.references.size > 0 ? [{
    title: 'FK',
    property: 'references',
    renderer: foreignKeyRenderer(),
    headRenderer: tooltipHeadRenderer("Foreign key: the DataObject this column references"),
    width: '180px',
    isSortable: false,
    visible: false
  }] : [];
  const baseColumns: any[] = [...keyColumns, {
    title: 'Column',
    property: 'name',
    width: '200px'
  }, {
    title: 'Datatype',
    property: 'dataType',
    width: '90px'
  }, ...foreignKeyColumns, {
    title: 'Description',
    property: 'description',
    width: '200px',
    renderer: tooltipCellRenderer()
  }];
  const optionalColumns = {
    distinctCount: {
      title: '%D',
      property: 'stats.distinctCount',
      renderer: percentageRenderer(stats?.numRows),
      headRenderer: tooltipHeadRenderer("Percentage of distinct values"),
      width: '60px',
      colSort: 1
    },  
    nullCount: {
      title: '%C',
      property: 'stats.nullCount',
      renderer: percentageRenderer(stats?.numRows, 1, true),
      headRenderer: tooltipHeadRenderer("Percentage of completion, e.g. value not null"),
      width: '60px',
      colSort: 2
    },  
    min: {
      title: 'Min',
      property: 'stats.min',
      renderer: nestedPropertyRenderer(),
      width: '75px',
      colSort: 3
    },
    max: {
      title: 'Max',
      property: 'stats.max',
      renderer: nestedPropertyRenderer(),
      width: '75px',
      colSort: 4
    },
    avgLen: {
      title: 'AvgLen',
      property: 'stats.avgLen',
      renderer: nestedPropertyRenderer(),

      width: '75px'
    },
    maxLen: {
      title: 'MaxLen',
      property: 'stats.maxLen',
      renderer: nestedPropertyRenderer(),
      width: '75px',
    }
  }
  const columns = useMemo(() => {
    if (!schemaRows) return undefined;    
    const cols = [...baseColumns];
    const statsKeys = schemaRows.filter(r => r.stats != undefined).map(r => Object.keys(r.stats)).flat()
    .filter(onlyUnique);
    statsKeys.map ( key =>
      optionalColumns[key] || {
        title: key,
        property: 'stats.'+key,
        renderer: nestedPropertyRenderer(),
        width: '75px'
      }
    ).sort(compareFunc('colSort'))
    .forEach(c => cols.push(c));
    return cols;
  }, [schemaRows, declaredKeys]);

  // prepare info message
  const info = (schema ? schema.info : getMissingSchemaFileCmp(props.elementType, props.elementName));

  // the column selection menu of the table, rendered above it - see DataTable.setToolbarElements.
  // It is only shown while the table is, so that it cannot outlive the table it belongs to.
  const [toolbarElements, setToolbarElements] = useState<JSX.Element>();

  return !schemaIsLoading ? (
    <Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem', gap: '1rem', width: '100%', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'end', gap: '1rem'}}>
        {props.schemaEntries && <FormControl>
          <FormLabel>Schema exported at</FormLabel>
          <Select size='sm' value={schemaEntry?.key} onChange={(ev, value) => setSchemaEntry(props.schemaEntries?.find((e) => e.key === value))}>
            {props.schemaEntries?.map((e) => <Option key={e.key} value={e.key}>{formatTimestamp(e.tstamp)}</Option>)}
          </Select>      
        </FormControl>}
        {props.statsEntries && <FormControl>
          <FormLabel>Statistics exported at</FormLabel>
          <Select size='sm' value={statsEntry?.key} onChange={(ev, value) => setStatsEntry(props.statsEntries?.find((e) => e.key === value))}>
            {props.statsEntries?.map((e) => <Option key={e.key} value={e.key}>{formatTimestamp(e.tstamp)}</Option>)}
          </Select>      
        </FormControl>}      
        <Box sx={{flex: 1}}/>
        {schemaRows && toolbarElements}
      </Box>
      {info && <InfoBox info={info}/>}
      {schemaRows && columns && <DataTable key={schemaEntry?.key+'/'+statsEntry?.key} data={schemaRows} columns={columns} keyAttr="id"
                                           // the nesting of a struct belongs on the column name, not on the PK column before it
                                           treeGroupKeyAttr={'parentId'} treeExpandColumn="name"
                                           name="schema" setToolbarElements={setToolbarElements}/>}
    </Sheet>
  ) : <CenteredCircularProgress/>
}
import { Box, CircularProgress, FormControl, FormLabel, Select, Sheet, Tooltip, Typography } from '@mui/joy';
import { useEffect, useMemo, useState } from 'react';
import { SchemaColumn, TsIndexEntry, useFetchDataObjectSchema, useFetchDataObjectStats } from '../../hooks/useFetchData';
import DataTable, { nestedPropertyRenderer } from './DataTable';
import { compareFunc, getPropertyByPath, onlyUnique } from '../../util/helpers';
import { formatTimestamp } from '../../util/WorkflowsExplorer/date';
import Option from '@mui/joy/Option';
import { OverflowTooltip } from './OverflowTooltip';
import { getMissingSchemaFileCmp } from './ElementDetails';
import InfoBox from './InfoBox';

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
export function tooltipCellRenderer() {
  return (prop: any) => {
    return (
      <OverflowTooltip text={prop.rowData[prop.column.key]} maxWidth='500px'/>
    );
  }
}

export default function SchemaTab(props: {elementType: string, elementName: string, schemaIndex: TsIndexEntry[] | undefined, statsIndex: TsIndexEntry[] | undefined, columnDescriptions: object|undefined}){

  // store the current schema entry to display
  const [schemaEntry, setSchemaEntry] = useState<TsIndexEntry>();

  // initialize schema entry if not yet set
  useEffect(() => {
    if (schemaEntry && !props.schemaIndex) {
      setSchemaEntry(undefined);
    } else if (props.schemaIndex && (!schemaEntry  || (schemaEntry && props.schemaIndex && props.schemaIndex.findIndex((e) => e.filename == schemaEntry.filename) < 0))) {
      setSchemaEntry(props.schemaIndex[0]);
    }
  }, [props.schemaIndex]);
  const { data: schema, isLoading: schemaIsLoading } = useFetchDataObjectSchema(schemaEntry);

  // store the current stats entry to display
  const [statsEntry, setStatsEntry] = useState<TsIndexEntry>();

  // initialize stats entry if not yet set
  useEffect(() => {
    if (statsEntry && !props.statsIndex) {
      setStatsEntry(undefined);
    } else if (props.statsIndex && (!statsEntry  || (statsEntry && props.statsIndex && props.statsIndex.findIndex((e) => e.filename == statsEntry.filename) < 0))) {
      setStatsEntry(props.statsIndex[0]);
    }
  }, [props.statsIndex]);
  const { data: stats, isLoading: statsIsLoading } = useFetchDataObjectStats(statsEntry);

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
      // create entry
      const currentRow: any = {id: ++currentId, parentId: parentId, path: currentPath, name: column.name, description: columnDescription, stats: colStats};
      rows.push(currentRow);
      // handle children
      const childRows = numberDataType(column.dataType, currentPath, currentRow.id)
      currentRow.dataType = (childRows.length === 0 ? column.dataType : column.dataType.dataType);
      rows.push(...childRows);
    })
    return rows;
  } 
  const schemaRows = useMemo(() => (schema?.schema ? numberSchemaTree(schema.schema) : undefined), [props.elementName, schema, stats]);

  // define columns for table
  const baseColumns: any[] = [{
    title: 'Column',
    property: 'name',
    width: '200px'
  }, {
    title: 'Datatype',
    property: 'dataType',
    width: '90px'
  }, {
    title: 'Description',
    property: 'description',
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
  }, [schemaRows]);

  // prepare info message
  const info = (schema ? schema.info : getMissingSchemaFileCmp(props.elementType, props.elementName));

  return !schemaIsLoading ? (
    <Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem', gap: '1rem', width: '100%', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: '1rem'}}>
        {props.schemaIndex && <FormControl>
          <FormLabel>Schema exported at</FormLabel>
          <Select size='sm' value={schemaEntry?.filename} onChange={(ev, value) => setSchemaEntry(props.schemaIndex?.find((e) => e.filename === value))}>
            {props.schemaIndex?.map((e) => <Option key={e.filename} value={e.filename}>{formatTimestamp(e.ts)}</Option>)}
          </Select>      
        </FormControl>}
        {props.statsIndex && <FormControl>
          <FormLabel>Statistics exported at</FormLabel>
          <Select size='sm' value={statsEntry?.filename} onChange={(ev, value) => setStatsEntry(props.statsIndex?.find((e) => e.filename === value))}>
            {props.statsIndex?.map((e) => <Option key={e.filename} value={e.filename}>{formatTimestamp(e.ts)}</Option>)}
          </Select>      
        </FormControl>}      
      </Box>
      {info && <InfoBox info={info}/>}
      {schemaRows && columns && <DataTable key={schemaEntry?.filename+'/'+statsEntry?.filename} data={schemaRows} columns={columns} keyAttr="id" treeGroupKeyAttr={'parentId'}/>}
    </Sheet>
  ) : <CircularProgress/>
}
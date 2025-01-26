import { Box, Checkbox, Dropdown, Menu, MenuButton, MenuItem, Typography } from "@mui/joy";
import { DataType, ITableInstance, Table, useTable } from 'ka-table';
import { SortDirection, SortingMode } from 'ka-table/enums';
import { Column } from 'ka-table/models';
import { useEffect, useMemo, useState } from "react";

import { ArrowDownward, ArrowUpward, ViewColumnOutlined } from "@mui/icons-material";
import "ka-table/style.css";
import { getIcon } from "../../util/WorkflowsExplorer/StatusInfo";
import { formatTimestamp } from "../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../util/WorkflowsExplorer/format";
import { arrayEquals, getPropertyByPath } from "../../util/helpers";
import CenteredCircularProgress from "../Common/CenteredCircularProgress";
import useLocalStorageState from "../../hooks/useLocalStorageState";

export function nestedPropertyRenderer(defaultValue: string = "", paddingRight: string = '0') {
  return (prop: any) => {
    const value = getPropertyByPath(prop.rowData, prop.column.key)
    return <div style={{ paddingRight: paddingRight }}>{value || defaultValue}</div>
  }
}

export function cellIconRenderer(prop: any) {
  return getIcon(prop.value, '0')
}

export function titleIconRenderer(prop: any) {
  return <div style={{ display: 'inline', verticalAlign: 'middle' }}>{getIcon(prop.column.title, '0')}</div>
}

export function dateRenderer(prop: any) {
  return formatTimestamp(prop.value)
}

export function durationRenderer(prop: any) {
  return formatDuration(prop.value)
}

export function fallbackRenderer(fallbackProperty: string) {
	return (prop: any) => {
		return  prop.value || prop.rowData[fallbackProperty];
    }
}

export function getColumnSelectionMenu(columns: any[], columnsVisible: {}, setColumnsVisible: ({}) => void, tableRef?: ITableInstance) {
  return <>
    <Dropdown>
        <MenuButton size="sm" variant="plain"><ViewColumnOutlined/></MenuButton>               
        <Menu size="sm">
            {columns.map((col: any, index) => (
                <MenuItem key={index}>
                    <Checkbox color="neutral" size="sm" variant="outlined" sx={{ mr: '0.5rem' }}
                        checked={(columnsVisible[col.property] ?? true)}
                        onChange={(x) => {
                            if (tableRef) {
                                if (x.target.checked) tableRef.showColumn(col.property);
                                else tableRef.hideColumn(col.property);
                                const newColumnsVisible = {...columnsVisible};
                                newColumnsVisible[col.property] = x.target.checked;                                    
                                setColumnsVisible(newColumnsVisible);
                            } else console.log("OOPS")
                        }}                            
                    />
                    <Typography>{col.title}</Typography>                        
                </MenuItem>                
            ))}
        </Menu>
    </Dropdown>
  </>    
}

function getInitialColumnsVisible(columns: any[]): object {
  const columnsVisibleMap = new Map(columns.filter(c => c.visible !== undefined).map(c => [c.property, c.visible]));
  return Object.fromEntries(columnsVisibleMap)
}

export default function DataTable(props: { data: any[], columns: any[], keyAttr: string, name?: string, minColumnWidth?: number, treeGroupKeyAttr?: string, navigate?: (any) => void, setToolbarElements?: (elements: JSX.Element) => void}) {

  const { data, keyAttr, treeGroupKeyAttr, minColumnWidth: columnMinWidth, navigate, setToolbarElements } = props;
  const [loading, setLoading] = useState(true)
  const dataTable = useTable();
  const [mouseDown, setMouseDown] = useState<number[]>(); // this is to capture mouse drag on row, and prevent click if mouse is moved... this allows to select text also if row click navigates to child page...
  const [columnsVisible, setColumnsVisible] = useLocalStorageState<object>(props.name + ".columnsVisible", () => getInitialColumnsVisible(props.columns))

  useEffect(() => {
    if (setToolbarElements) {
      if (!props.name) throw Error("DataTable name is needed if setToolbarElements is set!");
      const menu = getColumnSelectionMenu(props.columns, columnsVisible, setColumnsVisible, dataTable)
      setToolbarElements(menu)
    }
  }, [props.columns, columnsVisible]);

  const columns = useMemo(() => {
    return props.columns.map(c => ({...c, visible: columnsVisible[c.property]}))
  }, [props.columns, columnsVisible]);

  if (data && data.length > 0 && loading) setLoading(false);

  function inferDataType(prop: string) {
    const obj = data.find(d => getPropertyByPath(d, prop))
    const v = getPropertyByPath(obj, prop);
    switch (typeof v) {
      case 'object': {
        if (v instanceof Date) return DataType.Date;
        return DataType.Object;
      }
      case 'number': return DataType.Number;
      case 'boolean': return DataType.Boolean;
      case 'string': return DataType.String;
      default: return DataType.String;
    }
  }
  const tableColumns: Column[] = useMemo(() => {
    if (loading) return [];
    const cols = columns.map(c => {
      var col: Column;
      if (typeof c === 'object') {
        col = {
          key: c.property,
          title: c.title,
          dataType: inferDataType(c.property),
          width: '100px' // default column width
        }
        if (c.width) col.width = c.width;
        if (c.sortDirection) col.sortDirection = c.sortDirection;
        if (c.style) col.style = c.style;
        if (c.isSortable!==undefined) col.isSortable = c.isSortable;
        if (c.isResizable!==undefined) col.isResizable = c.isResizable;
        if (c.visible!==undefined) col.visible = c.visible;
      } else {
        col = { key: c, title: c, dataType: inferDataType(c) }
      }
      col.colGroup = { style: { minWidth: columnMinWidth || 100 } }
      return col;
    })
    cols[cols.length-1].width = undefined // remove width of last element for smooth column resizing and horizontal scrollbar of table
    return cols;
  }, [columns, loading]);

  const tableColumnsRenderer = useMemo(() => {
    const renderers = {}
    columns.filter(c => typeof c === 'object' && c.renderer)
      .forEach(c => renderers[c.property] = c.renderer);
    return renderers;
  }, [columns]);

  const tableHeadColumnsRenderer = useMemo(() => {
    const renderers = {}
    columns.filter(c => typeof c === 'object' && c.headRenderer)
      .forEach(c => renderers[c.property] = c.headRenderer);
    return renderers;
  }, [columns]);

  if (loading) return <CenteredCircularProgress />;

  return (
    <Box sx={{
      width: '100%', height: '100%',
      fontFamily: 'Roboto,Helvetica,Arial,sans-serif', fontWeight: '400', fontSize: '0.875rem', // defaults from MuiTypography-root
      '& ka-table-wrapper': { overflow: 'auto' },
      '& .ka-thead-cell-content, .ka-cell-text': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '25px' },
      '& .ka-row': (navigate ? { cursor: 'pointer', '&:hover': { backgroundColor: '#f0f0ef'}} : {}),
      '& .ka-thead-background': { backgroundColor: 'white' },
      '& .ka-thead-cell': { color: 'primary', zIndex: '99', fontWeight: '600', height: '25px', paddingTop: '7px', paddingBottom: '7px' },
      '& .ka-cell, .ka-thead-cell': { paddingLeft: '7px', paddingRight: '7px' },
      '& .ka-cell': { paddingTop: '4px', paddingBottom: '4px' },
      '& .ka-cell-text': { height: '25px' },
      '& .ka-thead-cell-resize': { left: '3px' },
      '& .ka': { height: '100%', width: '100%' }
    }}>
      <Table
        table={dataTable}
        rowKeyField={keyAttr}
        treeGroupKeyField={treeGroupKeyAttr}
        treeGroupsExpanded={[]}
        data={data}
        columns={tableColumns}
        columnResizing={true}
        sortingMode={SortingMode.Single}
        virtualScrolling={{
          enabled: true
        }}
        childComponents={{
          dataRow: {
            elementAttributes: () => ({
              onMouseDown: (e, data) => {
                // remember mouse down to evaluate click
                setMouseDown([e.clientX, e.clientY]);
              },   
              onClick: (e, data) => {
                // prevent navigate if mouse up was on different location
                // this allows to select text in the table, and also have navigate feature on proper click.
                if (arrayEquals([e.clientX,e.clientY], mouseDown) && navigate) navigate(data.childProps.rowData);
              }
            })
          },
          cellText: {
            content: (prop) => {
              if (tableColumnsRenderer && tableColumnsRenderer[prop.column.key]) return tableColumnsRenderer[prop.column.key](prop);
            }
          },
          headCellContent: {
            content: (prop) => {
              if (tableHeadColumnsRenderer && tableHeadColumnsRenderer[prop.column.key]) {
                return tableHeadColumnsRenderer[prop.column.key](prop);
              }
            }
          },
          sortIcon: {
            content: ({column}) => {
              return (column.sortDirection === SortDirection.Ascend ? <ArrowDownward fontSize="medium"/> : <ArrowUpward fontSize="medium"/> )
            }
          }
        }}
        sort={({ column }) => {
          if (column.key.endsWith('_at')) {
            return (a, b) => {
              var result = a === b ? 0
                : !a ? 1
                  : !b ? -1
                    : a < b ? -1 : 1;
              return result * (column.sortDirection === SortDirection.Ascend ? 1 : -1) as (0 | 1 | -1)
            }
          }
        }}
        noData={{ text: "No data found", hideHeader: true }}        
      />
    </Box>
  )
}
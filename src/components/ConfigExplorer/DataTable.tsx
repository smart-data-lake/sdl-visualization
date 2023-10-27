import { Box, CircularProgress } from "@mui/joy";
import { DataType, Table } from 'ka-table';
import { SortingMode, SortDirection } from 'ka-table/enums';
import { Column } from 'ka-table/models';
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "ka-table/style.css";
import { getIcon } from "../../util/WorkflowsExplorer/StatusInfo";
import { formatTimestamp } from "../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../util/WorkflowsExplorer/format";
import { getPropertyByPath } from "../../util/helpers";

export function nestedPropertyRenderer(defaultValue: string, paddingRight: string = '0') {
    return (prop: any) => {
        const value = getPropertyByPath(prop.rowData, prop.column.key)
        return <div style={{paddingRight: paddingRight}}>{value || defaultValue}</div>
    }
}

export function cellIconRenderer(prop: any) {
    return getIcon(prop.value, '0')
}

export function titleIconRenderer(prop: any) {
    return <div style={{display: 'inline', verticalAlign: 'middle'}}>{getIcon(prop.column.title, '0')}</div>
}

export function dateRenderer(prop: any) {
    return formatTimestamp(prop.value)
}

export function durationRenderer(prop: any) {
    return formatDuration(prop.value)
}


export default function DataTable(props: {data: any[], columns: any[], keyAttr: string, navigator?: (any) => string}) {

    const {data, columns, keyAttr, navigator} = props;
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate();

    if (data && data.length>0 && loading) setLoading(false);

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
    const tableColumns: Column[] = useMemo(() => (loading ? [] : columns.map(c => {
            var col: Column;
            if (typeof c === 'object') {
                col = {
                    key: c.property,
                    title: c.title,
                    dataType: inferDataType(c.property),                    
                }
                if (c.width) col.width = c.width;
                if (c.sortDirection) col.sortDirection = c.sortDirection;
                if (c.style) col.style = c.style;
            } else {
                col = {
                    key: c,
                    title: c,
                    dataType: inferDataType(c),
                }
            }
            col.colGroup = { style: { minWidth: 50 }}
            return col;
        }
    )), [columns,loading]);

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

    if (loading) return (<CircularProgress/>);

    return (
        <Box sx={{ flex: 1, minHeight: 0, width: '100%', height: '100%',
        fontFamily: 'Roboto,Helvetica,Arial,sans-serif', fontWeight: '400', fontSize: '0.875rem', // defaults from MuiTypography-root
        '& ka-table-wrapper': {overflow: 'auto'},
        '& .ka-thead-cell-content, .ka-cell-text': {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'},
        '& .ka-row': { cursor: 'pointer', '&:hover': { backgroundColor: '#f0f0ef' }},
        '& .ka-thead-background': { backgroundColor: 'white' },
        '& .ka-thead-cell': { color: 'primary', zIndex: '99', fontWeight: '600', height: '25px', paddingTop: '7px', paddingBottom: '7px'},
        '& .ka-cell, .ka-thead-cell': {paddingLeft: '7px', paddingRight: '7px'},
        '& .ka-cell': {paddingTop: '4px', paddingBottom: '4px'},
        '& .ka-cell-text': {height: '25px'},
        '& .ka-thead-cell-resize': {left: '3px'},
        '& .ka': {height: '100%', width: '100%'}
        }}>
            <Table
                rowKeyField={keyAttr}
                data={data}
                columns={tableColumns}
                columnResizing={true}
                sortingMode={SortingMode.Single}
                virtualScrolling= {{
                    enabled: true
                }}                
                childComponents={{
                    dataRow: {
                        elementAttributes: () => ({
                            onClick: (e,data) => { 
                                if (navigator) navigate(navigator(data.childProps.rowData));
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
                    }                    
                }}
                sort={({column}) => {
                    if (column.key.endsWith('_at')) {
                        return (a, b) => {
                            var result = a === b ? 0
                                : !a ? 1 
                                : !b ? -1
                                : a < b ? -1 : 1;
                            return result * (column.sortDirection === SortDirection.Ascend ? 1 : -1) as (0|1|-1)
                        }
                    }
                }}                
                noData={{ text: "No data found", hideHeader: true }}                                         
            />
        </Box>
    )
  }
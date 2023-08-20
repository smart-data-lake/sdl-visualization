import { Box, CircularProgress } from "@mui/joy";
import { DataType, Table } from 'ka-table';
import { SortingMode } from 'ka-table/enums';
import { Column } from 'ka-table/models';
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "ka-table/style.css";
import { getPropertyByPath } from "../../util/helpers";


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
        '& .ka-cell': {paddingTop: '5px', paddingBottom: '5px'},
        '& .ka-cell-text': {height: '23px'},
        '& .ka-thead-cell-resize': {left: '3px'},
        '& .ka': {height: '100%', width: '100%'}
        }}>
            <Table
                rowKeyField={keyAttr}
                data={data}
                columns={tableColumns}
                columnResizing={true}
                sortingMode={SortingMode.Single}
                childComponents={{
                    dataRow: {
                        elementAttributes: () => ({
                            onClick: (e,data) => { 
                                if (navigator) navigate(navigator(data.childProps.rowData));
                            }
                        })
                    },
                    cellText: {                        
                        content: (props) => {
                          if (tableColumnsRenderer && tableColumnsRenderer[props.column.key]) return tableColumnsRenderer[props.column.key](props.value);
                        }
                    }                    
                }}
                noData={{ text: "No data found", hideHeader: true }}                                         
            />
        </Box>
    )
  }
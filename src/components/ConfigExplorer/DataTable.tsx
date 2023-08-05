import { Box } from "@mui/joy";
import { DataType, Table } from 'ka-table';
import { SortingMode } from 'ka-table/enums';
import { Column } from 'ka-table/models';
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import "ka-table/style.css";
import { getPropertyByPath } from "../../util/helpers";


export default function DataTable(props: {data: any[], columns: string[], navigatePrefix: string, navigateAttr: string}) {

    const {data, columns, navigatePrefix, navigateAttr} = props;
    const navigate = useNavigate();

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
    const tableColumns: Column[] = useMemo(() => columns.map(
        (c, index) => ({
            key: c,
            colGroup: { style: { minWidth: 50 }},
            //width: 200,
            title: c,
            type: inferDataType(c),
        }),
    ), [columns]);

    return (
        <Box sx={{ height: '100%', 
        fontFamily: 'Roboto,Helvetica,Arial,sans-serif', fontWeight: '400', fontSize: '0.875rem', // defaults from MuiTypography-root
        '& ka-table-wrapper': {overflowY: 'auto'},
        '& .ka-thead-cell-content, .ka-cell-text': {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'},
        '& .ka-row': { cursor: 'pointer', '&:hover': { backgroundColor: '#f0f0ef' }},
        '& .ka-thead-background': { backgroundColor: 'white' },
        '& .ka-thead-cell': { color: 'primary', fontWeight: '600' },
        '& .ka-cell, .ka-thead-cell': {height: '1em', paddingLeft: '7px', paddingRight: '7px', paddingTop: '7px', paddingBottom: '7px'},
        '& .ka-thead-cell-resize': {left: '5px'},
        '& .ka': {height: '100%'}
        }}>
            <Table
                rowKeyField={'id'}
                data={data}
                columns={tableColumns}
                columnResizing={true}
                sortingMode={SortingMode.Single}
                //paging= {{
                //    enabled: true,
                //    pageIndex: 0,
                //    pageSize: 25,
                //    pageSizes: [10, 25, 50, 100],
                //    position: PagingPosition.Bottom
                //}}
                childComponents={{
                    dataRow: {
                        elementAttributes: () => ({
                            onClick: (e,data) => {
                                navigate(navigatePrefix+data.childProps.rowKeyValue);
                            }
                        })
                    }
                }}
                noData={{ text: "No data found", hideHeader: true }}                                         
            />
        </Box>
    )
  }
import { Box, Table } from "@mui/joy";
import { TablePagination } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


export default function DataTable(props: {data: any[], columns: string[], navigatePrefix: string, navigateAttr: string}) {

    const {data, columns, navigatePrefix, navigateAttr} = props;
    const [pageData, setPageData] = useState<any[]>([]);
    const [pageNb, setPageNb] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const navigate = useNavigate();

    useEffect(() => {
        setPageData(data.slice(pageNb*rowsPerPage, pageNb*rowsPerPage + rowsPerPage));
    }, [data, pageNb, rowsPerPage])

    function handleChangeRowsPerPage(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const newRowsPerPage = parseInt(event.target.value, 25)
        const newPageNb = pageNb * rowsPerPage / newRowsPerPage;
        setRowsPerPage(newRowsPerPage);
        setPageNb(newPageNb);
    }

    function handleChangePage(event: React.MouseEvent<HTMLButtonElement> | null, newPageNb: number) {
        setPageNb(newPageNb);
    }

    function prepValue(v: any) {
        if (typeof v === 'object') return JSON.stringify(v);
        return v
    }
    
    return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Box sx={{ maxHeight: '64vh', overflow: 'auto' }}>
            <Table size='sm' hoverRow color='neutral' stickyHeader>
                <thead>
                    <tr>
                        {columns.map(c => <th>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {pageData.map(row => (
                        <tr style={{cursor: 'pointer'}} onClick={() => navigate(navigatePrefix+row[navigateAttr])}>
                            {columns.map(c => <td>{prepValue(row[c])}</td>)}
                        </tr>
                    ))}
                </tbody>
            </Table>
        </Box>
        <TablePagination component="div" count={data.length} page={pageNb} onPageChange={handleChangePage} rowsPerPage={rowsPerPage} onRowsPerPageChange={handleChangeRowsPerPage}/>
    </Box>
    )
  }
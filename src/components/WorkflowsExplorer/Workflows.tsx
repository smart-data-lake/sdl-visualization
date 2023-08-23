import { CircularProgress, Sheet } from "@mui/joy";
import { useEffect, useState } from "react";
import useFetchWorkflows from "../../hooks/useFetchData";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { checkFiltersAvailability, defaultFilters, getIcon } from "../../util/WorkflowsExplorer/StatusInfo";
import { formatTimestamp } from "../../util/WorkflowsExplorer/date";
import { formatDuration } from "../../util/WorkflowsExplorer/format";
import DataTable from "../ConfigExplorer/DataTable";
import ToolBar from "./ToolBar/ToolBar";
import { SortDirection } from "ka-table";

export default function Workflows() {
    const { data, isLoading, isFetching, refetch } = useFetchWorkflows();
    const [selData, setSelData] = useState<any[]>([]);

    useEffect(() => {
        if (data && data.length>0 && selData.length===0) {
            setSelData(data);
        }
    }, [data, selData])

    if (isLoading || isFetching) return <CircularProgress/>;
    //if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);
    
    const columns = [{
        title: 'Name',
        property: 'name',
        sortDirection: SortDirection.Ascend,
    }, {
        title: 'Last status',
        property: 'lastStatus',
        renderer: getIcon,
        width: '100px'
    }, {
        title: 'Last duration',
        property: 'lastDuration',
        renderer: (x) => formatDuration(x),
        width: '150px'
    }
    , {
		title: 'Last attempt',
		property: 'lastAttemptStartTime',
		renderer: (x) => formatTimestamp(x),
		width: '175px'
	}, {
        title: '# runs',
        property: 'numRuns',
        width: '100px'
    }, {
        title: '# attempts',
        property: 'numAttempts',
        width: '100px'
    }]

    return (    
        <>
            {data ? (
                <Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem 1rem', gap: '1rem', width: '100%', height: '100%' }}>
                    <PageHeader title={'Workflows'} noBack={true} refresh={refetch}/>
                    <ToolBar 
                        controlledRows={data} 
                        updateRows={setSelData} 
                        filters={checkFiltersAvailability(data, defaultFilters('lastStatus'))}
                        searchColumn={"name"}
                        searchPlaceholder="Search by name"
                        searchMode="contains"
                    />
                    <DataTable data={selData} columns={columns} navigator={(row) => `/workflows/${row.name}`} keyAttr="name"/>
                </Sheet>
            ):(<NotFound/>)}
        </>
    );
}

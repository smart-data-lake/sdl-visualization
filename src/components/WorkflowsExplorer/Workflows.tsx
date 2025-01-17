import { Sheet } from "@mui/joy";
import { SortDirection } from "ka-table";
import { useMemo, useState } from "react";
import { fetcher } from "../../api/Fetcher";
import useFetchWorkflows from "../../hooks/useFetchData";
import { useUser } from "../../hooks/useUser";
import { useWorkspace } from "../../hooks/useWorkspace";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { checkFiltersAvailability, stateFilters } from "../../util/WorkflowsExplorer/StatusInfo";
import CenteredCircularProgress from "../Common/CenteredCircularProgress";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer } from '../ConfigExplorer/DataTable';
import ToolBar from "./ToolBar/ToolBar";
import { FilterParams, filterSearchText } from "./WorkflowHistory";

export default function Workflows() {
    const userContext = useUser();
    const { data, isLoading, isFetching, refetch } = useFetchWorkflows(!userContext || userContext.authenticated);
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'contains', searchColumn: 'name', additionalFilters: []})
	const {navigateRel} = useWorkspace();

    const selData = useMemo(() => {
        if (data && data.length>0) {
			var selected = data;
			if (filterParams.searchText) {
				selected = selected.filter((row) => filterSearchText(filterParams, row));
			}
			if (filterParams.additionalFilters.length > 0) {
				selected = selected.filter(row => filterParams.additionalFilters.some(filter => filter.predicate(row)));
			}
			return selected;
		} else {
			return [];
		}
    }, [data, filterParams])

    if (isLoading || isFetching) return <CenteredCircularProgress/>;
    //if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);
    
	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams({...filterParams, ...partialFilter})
	}

	function refreshData() {
		fetcher().clearCache();
		refetch();
	}    

    const columns = [{
        title: 'Name',
        property: 'name',
    }, {
        title: 'Last status',
        property: 'lastStatus',
        renderer: cellIconRenderer,
        width: '100px'
    }, {
        title: 'Last duration',
        property: 'lastDuration',
        renderer: durationRenderer,
        width: '150px'
    }
    , {
		title: 'Last attempt',
		property: 'lastAttemptStartTime',
		renderer: dateRenderer,
		width: '175px',
	        sortDirection: SortDirection.Descend
	}, {
        title: '# runs',
        property: 'numRuns',
        width: '100px'
    }, {
        title: '# attempts',
        property: 'numAttempts',
        width: '100px'
    }, {
        title: '# actions',
        property: 'lastNumActions',
        width: '100px'
    }]

    return (    
        <>
            {data ? (
                <Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem 1rem', gap: '1rem', width: '100%', height: '100%' }}>
                    <PageHeader title={'Workflows'} refresh={refreshData}/>
                    <ToolBar 
                        data={data} 
                        filterParams={filterParams}
                        updateFilterParams={updateFilterParams}
                        stateFilters={checkFiltersAvailability(data, stateFilters('lastStatus'))}
                        searchPlaceholder="Search by name"
                    />
                    <DataTable data={selData} columns={columns} navigate={(row) => navigateRel(row.name)} keyAttr="name"/>
                </Sheet>
            ):(<NotFound/>)}
        </>
    );
}

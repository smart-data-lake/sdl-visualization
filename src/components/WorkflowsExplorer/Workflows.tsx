import { CircularProgress, Sheet } from "@mui/joy";
import { SortDirection } from "ka-table";
import { useMemo, useState } from "react";
import useFetchWorkflows from "../../hooks/useFetchData";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { checkFiltersAvailability, stateFilters } from "../../util/WorkflowsExplorer/StatusInfo";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer } from '../ConfigExplorer/DataTable';
import ToolBar from "./ToolBar/ToolBar";
import { FilterParams, filterSearchText } from "./WorkflowHistory";

export default function Workflows() {
    const { data, isLoading, isFetching, refetch } = useFetchWorkflows();
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'contains', searchColumn: 'name', additionalFilters: []})

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

    if (isLoading || isFetching) return <CircularProgress/>;
    //if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);
    
	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams({...filterParams, ...partialFilter})
	}

    const columns = [{
        title: 'Name',
        property: 'name',
        sortDirection: SortDirection.Ascend,
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
		width: '175px'
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
                    <PageHeader title={'Workflows'} noBack={true} refresh={refetch}/>
                    <ToolBar 
                        data={data} 
                        filterParams={filterParams}
                        updateFilterParams={updateFilterParams}
                        stateFilters={checkFiltersAvailability(data, stateFilters('lastStatus'))}
                        searchPlaceholder="Search by name"
                    />
                    <DataTable data={selData} columns={columns} navigator={(row) => `/workflows/${row.name}`} keyAttr="name"/>
                </Sheet>
            ):(<NotFound/>)}
        </>
    );
}

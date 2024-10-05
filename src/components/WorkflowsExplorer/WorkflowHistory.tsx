import { ZoomOutOutlined } from "@mui/icons-material";
import { Box, IconButton, Sheet, Tooltip, Typography } from "@mui/joy";
import { SortDirection } from 'ka-table';
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { fetcher } from "../../api/Fetcher";
import { useFetchWorkflowRuns } from "../../hooks/useFetchData";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { Filter, checkFiltersAvailability, stateFilters } from "../../util/WorkflowsExplorer/StatusInfo";
import CenteredCircularProgress from "../Common/CenteredCircularProgress";
import { createFeedChip } from "../ConfigExplorer/ConfigurationTab";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer, nestedPropertyRenderer, titleIconRenderer } from '../ConfigExplorer/DataTable';
import HistoryBarChart from "./HistoryChart/HistoryBarChart";
import ToolBar from "./ToolBar/ToolBar";
import { useUser } from "../../hooks/useUser";


export type FilterParams = {
	searchMode: 'equals' | 'contains' | 'startsWith'
	searchColumn: string
	searchText?: string
	dateRange?: [Date,Date]
	additionalFilters: Filter[]
}

export function filterSearchText(params: FilterParams, row: any): boolean {
	if (params.searchText) {
		if (params.searchMode === 'equals') return row[params.searchColumn].toString().toLowerCase() === params.searchText!.toLowerCase();
		if (params.searchMode === 'contains') return row[params.searchColumn].toString().toLowerCase().includes(params.searchText!.toLowerCase());
		if (params.searchMode === 'startsWith') return row[params.searchColumn].toString().toLowerCase().startsWith(params.searchText!.toLowerCase());
	}
	return true;
}

/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
*/
export default function WorkflowHistory() {
	const {flowId} = useParams();
    const userContext = useUser();
	const { data, isLoading, isFetching, refetch } = useFetchWorkflowRuns(flowId!, !userContext || userContext.authenticated);
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'startsWith', searchColumn: 'runId', additionalFilters: []})
    const currURL = useLocation().pathname;
		
    const selData = useMemo(() => {
        if (data && data.length>0) {
			var selected = data;
			if (filterParams.dateRange) {
				selected = selected.filter((row) => row.attemptStartTime >= filterParams.dateRange![0] && row.attemptStartTime <= filterParams.dateRange![1])
			}
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

	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams({...filterParams, ...partialFilter})
	}

	function feedSelLinkRenderer(prop: any) {
		return createFeedChip(prop.value, 'actions', 'sm', {mt: -1});
	}

	function refreshData() {
		fetcher().clearCache();
		refetch();
	}

	if (isLoading || isFetching) {
		return <CenteredCircularProgress />;
	}

	const columns = [{
		title: 'Run',
		property: 'runId',
		width: '75px'
	}, {
		title: 'Attempt',
		property: 'attemptId',
		width: '80px'
	}, {
		title: 'Run Start',
		property: 'runStartTime',
		renderer: dateRenderer,
		width: '175px'
	}, {
		title: 'Attempt Start',
		property: 'attemptStartTime',
		renderer: dateRenderer,
		width: '175px',
        sortDirection: SortDirection.Descend,
	}, {
		title: 'Duration',
		property: 'duration',
		renderer: durationRenderer,
		width: '100px'
	}, {
		title: 'Status',
		property: 'status',
		renderer: cellIconRenderer,
		width: '75px'
	}, {
		title: 'Feed Selector',
		property: 'feedSel',
		renderer: feedSelLinkRenderer,
		width: '150px'
	}, {
		title: 'SUCCEEDED',
		property: 'actionsStatus.SUCCEEDED',
		headRenderer: titleIconRenderer,
		renderer: nestedPropertyRenderer('0', '7px'),
		style: { textAlign: 'right' },
		width: '51px' // min width for sorting
	}, {
		title: 'SKIPPED',
		property: 'actionsStatus.SKIPPED',
		headRenderer: titleIconRenderer,
		renderer: nestedPropertyRenderer('0', '7px'),
		style: { textAlign: 'right' },
		width: '51px' // min width for sorting
	}, {
		title: 'FAILED',
		property: 'actionsStatus.FAILED',
		headRenderer: titleIconRenderer,
		renderer: nestedPropertyRenderer('0', '7px'),
		style: { textAlign: 'right' },
		width: '51px' // min width for sorting
	}, {				
		title: 'SDLB Version',
		property: 'buildVersion',
		//width: '150px'
	}, {
		title: 'App Version',
		property: 'appVersion',
		//width: '150px'
	}]

	return (
		<>
		{!data || isLoading || isFetching ? <CenteredCircularProgress/> : null}
		{data ? (
			<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '5px 15px', gap: '15px', width: '100%', height: '100%' }}>
				<PageHeader title={flowId!} refresh={refreshData} />    
				<Sheet>
					<Sheet sx={{display: 'flex', width: '100%', pb: '0.5rem', gap: '1rem'}}>
						<Tooltip variant="solid" placement="right" title="This chart displays the runs in the current page. You can select a range or jump to a detailed run view by clicking on the corresponding bar.">
							<Sheet sx={{display: 'flex', gap: '1rem'}}>
								<Typography level='title-md'>Runs</Typography>
								<Typography level='body-md' sx={{color: 'gray'}}>{selData.length} runs displayed</Typography>
							</Sheet>
						</Tooltip>
						<Box sx={{flex: 1}}/>
						<IconButton onClick={(e) => updateFilterParams({dateRange: undefined})} disabled={filterParams.dateRange == undefined} variant="plain" color="neutral" size="md"><ZoomOutOutlined/></IconButton>
					</Sheet>
					<Box onMouseDown={(e) => e.preventDefault()}>
						<HistoryBarChart runs={selData} selectRange={(range) => updateFilterParams({dateRange: range})}/>
					</Box>
				</Sheet>				         
				<ToolBar 
					data={data}
					updateFilterParams={updateFilterParams}
					searchPlaceholder={'Search by Run ID'}
					stateFilters={checkFiltersAvailability(data, stateFilters('status'))}
					filterParams={filterParams}
					datetimePicker={true}/>
				<DataTable data={selData} columns={columns} navigator={(row) => `${currURL}/${row.runId}.${row.attemptId}/timeline`} keyAttr='path'/>
			</Sheet>   
		):(<NotFound errorType={500}/>)
	}
	</>);
}

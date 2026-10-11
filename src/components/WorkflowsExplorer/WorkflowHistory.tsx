import { DeleteOutlined, ZoomOutOutlined } from "@mui/icons-material";
import { Alert, Box, Button, DialogActions, DialogContent, DialogTitle, IconButton, Modal, ModalDialog, Sheet, Tooltip, Typography } from "@mui/joy";
import { SortDirection } from 'ka-table';
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetcher } from "../../api/Fetcher";
import { useFetchMe, useFetchWorkflowRuns } from "../../hooks/useFetchData";
import { useUser } from "../../hooks/useUser";
import { useLiveWorkflowUpdates } from "../../hooks/useLiveWorkflowUpdates";
import { useWorkspace } from "../../hooks/useWorkspace";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { Filter, checkFiltersAvailability, stateFilters } from "../../util/WorkflowsExplorer/StatusInfo";
import CenteredCircularProgress from "../Common/CenteredCircularProgress";
import { createFeedChip } from "../ConfigExplorer/ConfigurationTab";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer, fallbackRenderer, nestedPropertyRenderer, titleIconRenderer, tooltipCellRenderer } from '../ConfigExplorer/DataTable';
import HistoryBarChart from "./HistoryChart/HistoryBarChart";
import ToolBar from "./ToolBar/ToolBar";
import { useQueryClient } from "react-query";
import { WorkflowRun } from "../../types";


export type FilterParams = {
	searchMode: 'equals' | 'contains' | 'startsWith'
	searchColumn: string
	searchText?: string
	dateRange?: [Date,Date]
	additionalFilters: Filter[]
}

export function filterByGroup(filters: Filter[], rows: any[]): any[] {
	const filterGrps = Object.values(Object.groupBy(filters, f => f.group));
	return rows.filter(row => filterGrps.map(filters => filters!.some(filter => filter.predicate(row))).every(x => x));
}

export function filterSearchText(params: FilterParams, row: any): boolean {
	if (params.searchText) {
		if (params.searchMode === 'equals') return row[params.searchColumn].toString().toLowerCase() === params.searchText!.toLowerCase();
		if (params.searchMode === 'contains') return row[params.searchColumn].toString().toLowerCase().includes(params.searchText!.toLowerCase());
		if (params.searchMode === 'startsWith') return row[params.searchColumn].toString().toLowerCase().startsWith(params.searchText!.toLowerCase());
	}
	return true;
}

function feedSelLinkRenderer(prop: any) {
	return createFeedChip(prop.value, 'actions', 'sm', {mt: -1});
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
	property: 'sdlbVersionInfo.version',
	renderer: fallbackRenderer('buildVersion')
}, {
	title: 'App Version',
	property: 'appVersionInfo.version',
	renderer: fallbackRenderer('appVersion'),
	flex: true // otherwise the delete column, being last, would take the remaining width
}, {
	// what the first action in the DAG selected, precalculated when the attempt is indexed
	title: 'Selected Partition Values',
	property: 'selectedPartitionValues',
	renderer: tooltipCellRenderer(),
	width: '250px',
	visible: false
}]

function deleteColumn(onDelete: (run: WorkflowRun) => void) {
	return {
		title: 'Delete',
		property: 'delete',
		width: '50px',
		minWidth: 50,
		isSortable: false,
		isResizable: false,
		headRenderer: () => <></>,
		renderer: (prop: any) => (
			<Tooltip title="Delete this attempt" placement="left" enterDelay={500}>
				<IconButton size="sm" variant="plain" color="danger" sx={{'--IconButton-size': '26px', my: -0.5}}
					// the row navigates to the attempt on click
					onMouseDown={e => e.stopPropagation()}
					onClick={e => { e.stopPropagation(); onDelete(prop.rowData); }}>
					<DeleteOutlined/>
				</IconButton>
			</Tooltip>
		)
	}
}

/** Asks before deleting an attempt, as nothing can bring its state file back. */
function DeleteRunDialog(props: { run?: WorkflowRun, onClose: () => void, onDeleted: () => void }) {
	const { run, onClose, onDeleted } = props;
	const { tenant, repo, env } = useWorkspace();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	const close = () => { setError(undefined); onClose(); };
	const remove = async () => {
		setBusy(true);
		setError(undefined);
		try {
			await fetcher().deleteRun!(tenant!, repo!, env!, run!.name, run!.runId, run!.attemptId);
			onDeleted();
			close();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal open={!!run} onClose={busy ? undefined : close}>
			<ModalDialog role="alertdialog" sx={{maxWidth: '30rem'}}>
				<DialogTitle>Delete attempt {run?.runId}.{run?.attemptId}?</DialogTitle>
				<DialogContent>
					Its state file and everything derived from it are removed from {run?.name}. This cannot be undone.
					{error && <Alert color="danger" variant="soft" sx={{mt: 1}}>{error}</Alert>}
				</DialogContent>
				<DialogActions>
					<Button color="danger" loading={busy} onClick={remove}>Delete</Button>
					<Button variant="plain" color="neutral" disabled={busy} onClick={close}>Cancel</Button>
				</DialogActions>
			</ModalDialog>
		</Modal>
	);
}

/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
*/
export default function WorkflowHistory() {
	const {flowId} = useParams();
    const userContext = useUser();
	const enabled = !userContext || userContext.authenticated;
	const { data, isLoading, refetch } = useFetchWorkflowRuns(flowId!, enabled);
	const live = useLiveWorkflowUpdates(flowId, enabled, !!data?.some(run => run.status?.toUpperCase().endsWith('ING')));
	const [filterParams, setFilterParams] = useState<FilterParams>({searchMode: 'startsWith', searchColumn: 'runId', additionalFilters: []})
    const [[additionalLeftToolbarElements, additionalRightToolbarElements], setAdditionalToolbarElements] = useState<[JSX.Element?, JSX.Element?]>([]);
	const {navigateRel} = useWorkspace();
	const queryClient = useQueryClient();
	const [toDelete, setToDelete] = useState<WorkflowRun>();
	// only offered to an admin, and only by a backend that can delete
	const me = useFetchMe();
	const canDelete = !!fetcher().deleteRun && me.data?.admin === true;
	const tableColumns = useMemo(() => canDelete ? [...columns, deleteColumn(setToDelete)] : columns, [canDelete]);
		
    const selData = useMemo(() => {
        if (data && data.length>0) {
			var selected = data;
			if (filterParams.dateRange) {
				selected = selected.filter((row) => row.attemptStartTime !== undefined && row.attemptStartTime >= filterParams.dateRange![0] && row.attemptStartTime <= filterParams.dateRange![1])
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

	// merge into the previous value: the filter menus report their initial selection on mount, so two
	// of them updating in the same render must not overwrite each other
	function updateFilterParams(partialFilter: Partial<FilterParams>) {
		setFilterParams(prev => ({...prev, ...partialFilter}))
	}

	function refreshData() {
		fetcher().clearCache();
		refetch();
		queryClient.invalidateQueries(["workflows"]);
	}

	// only the first load: a refetch keeps showing the runs until the new list arrives
	if (isLoading) {
		return <CenteredCircularProgress />;
	}

	return (
		<>
		{!data ? <CenteredCircularProgress/> : null}
		{data ? (
			<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '0.1rem 1rem', gap: '1rem', width: '100%', height: '100%' }}>
				<PageHeader title={flowId!} refresh={refreshData} live={live} />    
				<Sheet>
					<Sheet sx={{display: 'flex', width: '100%', pb: '0.5rem', gap: '1rem'}}>
						<Tooltip variant="solid" placement="right" title="This chart displays the runs in the current page. You can select a range or jump to a detailed run view by clicking on the corresponding bar.">
							<Sheet sx={{display: 'flex', gap: '1rem'}}>
								<Typography level='title-md'>Runs</Typography>
								<Typography level='body-md' sx={{color: 'gray'}}>{selData.length} attempts displayed</Typography>
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
					storageKeyPrefix="workflowHistory"
					datetimePicker={true}
                    leftElements={additionalLeftToolbarElements}
                    rightElements={additionalRightToolbarElements}/>
				<Box sx={{height: '100%', width: '100%', overflow: 'auto', mb: '1rem'}}>
					<DataTable data={selData} columns={tableColumns} minColumnWidth={50} name="workflowHistory"
						navigate={(row) => navigateRel(`${row.runId}.${row.attemptId}/timeline`)} keyAttr='path'
						setToolbarElements={(elements: JSX.Element) => setAdditionalToolbarElements([undefined, elements])}
					/>
				</Box>
				<DeleteRunDialog run={toDelete} onClose={() => setToDelete(undefined)} onDeleted={refreshData}/>
			</Sheet>   
		):(<NotFound errorType={500}/>)
	}
	</>);
}

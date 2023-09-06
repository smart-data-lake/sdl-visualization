import { CircularProgress, Sheet } from "@mui/joy";
import { SortDirection } from 'ka-table';
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useFetchWorkflowRuns } from "../../hooks/useFetchData";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { checkFiltersAvailability, defaultFilters } from "../../util/WorkflowsExplorer/StatusInfo";
import { durationMillis } from "../../util/WorkflowsExplorer/date";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer, nestedPropertyRenderer, titleIconRenderer } from '../ConfigExplorer/DataTable';
import ChartControl from "./HistoryChart/ChartControl";
import ToolBar from "./ToolBar/ToolBar";


export type Indices = {
	rangeLeft?: number, 
	rangeRight?: number,
}

/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
*/
export default function WorkflowHistory() {
	const {flowId} = useParams();
	const { data, isLoading, isFetching, refetch } = useFetchWorkflowRuns(flowId!);
	const [selData, setSelData] = useState<any[]>([]);
	const [barChartData, setBarChartData] = useState<any[]>([])
	const [lineChartData, setLineChartData] = useState<any[]>([])
	const [indices, setIndices] = useState<Indices>({})
	const [open, setOpen] = useState<Boolean>(false)
    const currURL = useLocation().pathname;
		
    useEffect(() => {
        if (data && data.length>0 && selData.length===0) {
			setSelData(data);
		}
    }, [data, selData])

	useEffect(() => {
		setBarChartData(generateChartData(selData))
		setLineChartData(generateChartData(selData))	
	}, [selData])
	
	const handleDateRangeChange = (start: Date, end: Date) => {
		const filteredRows = data.filter((row) => {
			const date = new Date(row.attemptStartTime)
			return date >= start && date <= end
		})
		setSelData(filteredRows)

		let rangeRight = 0;		
		for (let i = 0; i < data.length; i++) {
			if (filteredRows[0].attemptStartTime === data[i].attemptStartTime) {
				rangeRight = i;
				break;
			}
		}
		setIndices({rangeLeft: data.length - (rangeRight + filteredRows.length), rangeRight: data.length - 1 - rangeRight})
	}
	
	const generateChartData = (data: any) => {
		const res : {
			value: number,
			status: string,
			name: string,
			runId: number,
			attemptId: number
		}[] = [];
				
		data.forEach((run) => {
			res.push({
					value: durationMillis(run.duration),
					status: run.status,
					name: run.attemptStartTime,
					runId: run.runId,
					attemptId: run.attemptId    
				})
		});
		return res;
	}
	
	if (isLoading || isFetching) {
		return (<CircularProgress/>);
	}

	console.log(data)

	const columns = [{
		title: 'Run ID',
		property: 'runId',
		width: '100px'
	}, {
		title: 'Attempt ID',
		property: 'attemptId',
		width: '100px'
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
		{!data || isLoading || isFetching ? <CircularProgress/> : null}
		{data ? (
			<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '5px 15px', gap: '15px', width: '100%', height: '100%' }}>
				<PageHeader title={flowId!} refresh={refetch} />             
				<ChartControl runs={data}/>
				<ToolBar 
					controlledRows={data} 
					updateRows={setSelData}
					searchColumn={'runId'}
					searchMode={'equals'}
					searchPlaceholder={'Search by Run ID'}
					filters={checkFiltersAvailability(data, defaultFilters())}
					datetimePicker={handleDateRangeChange}
					/>
				<DataTable data={selData} columns={columns} navigator={(row) => `${currURL}/${row.runId}/${row.attemptId}/timeline`} keyAttr='path'/>
			</Sheet>   
		):(<NotFound errorType={500}/>)
	}
	</>);
}

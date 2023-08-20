import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { CircularProgress, Sheet } from "@mui/joy";
import IconButton from '@mui/joy/IconButton';
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useFetchWorkflow } from "../../hooks/useFetchData";
import NotFound from "../../layouts/NotFound";
import PageHeader from "../../layouts/PageHeader";
import { checkFiltersAvailability, defaultFilters, getIcon } from "../../util/WorkflowsExplorer/StatusInfo";
import { durationMicro, formatTimestamp } from "../../util/WorkflowsExplorer/date";
import { formatDuration } from '../../util/WorkflowsExplorer/format';
import DataTable from '../ConfigExplorer/DataTable';
import ChartControl from "./HistoryChart/ChartControl";
import ToolBar from "./ToolBar/ToolBar";
import { SortDirection } from 'ka-table';


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
	const { data, isLoading, isFetching } = useFetchWorkflow(flowId!);
	const [selData, setSelData] = useState<any[]>([]);
	const [barChartData, setBarChartData] = useState<any[]>([])
	const [lineChartData, setLineChartData] = useState<any[]>([])
	const [indices, setIndices] = useState<Indices>({})
	const [open, setOpen] = useState<Boolean>(false)
    const currURL = useLocation().pathname;
		
    useEffect(() => {
        if (data && data.runs && data.runs.length>0 && selData.length===0) {
			setSelData(data.runs);
		}
    }, [data, selData])

	useEffect(() => {
		setBarChartData(generateChartData(selData))
		setLineChartData(generateChartData(selData))	
	}, [selData])
	
	const handleDateRangeChange = (start: Date, end: Date) => {
		const filteredRows = data.runs.filter((row) => {
			const date = new Date(row.attemptStartTime)
			return date >= start && date <= end
		})
		setSelData(filteredRows)

		let rangeRight = 0;		
		for (let i = 0; i < data.runs.length; i++) {
			if (filteredRows[0].attemptStartTime === data.runs[i].attemptStartTime) {
				rangeRight = i;
				break;
			}
		}
		setIndices({rangeLeft: data.runs.length - (rangeRight + filteredRows.length), rangeRight: data.runs.length - 1 - rangeRight})
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
					value: durationMicro(run.duration),
					status: run.status,
					name: run.attemptStartTime,
					runId: run.runId,
					attemptId: run.attemptId    
				})
		});
		return res;
	}
	
	if (isLoading || isFetching) {
		console.log("fetching");
		return (<CircularProgress/>);
	}
	console.log(data);

	const columns = [{
		title: 'Run ID',
		property: 'runId',
		width: '150px'
	}, {
		title: 'Attempt ID',
		property: 'attemptId',
		width: '150px'
	}, {
		title: 'Run Start',
		property: 'runStartTime',
		renderer: (x) => formatTimestamp(x),
		width: '175px'
	}, {
		title: 'Attempt Start',
		property: 'attemptStartTime',
		renderer: (x) => formatTimestamp(x),
		width: '175px',
        sortDirection: SortDirection.Descend,
	}, {
		title: 'Duration',
		property: 'duration',
		renderer: (x) => formatDuration(x),
		width: '150px'
	}, {
		title: 'Status',
		property: 'status',
		renderer: getIcon,
		width: '100px'
	}, {
		title: 'Feed Selector',
		property: 'feedSel',
		width: '150px'
	}, {
		title: 'Build Version',
		property: 'buildVersion',
		//width: '150px'
	}]

	return (
		<>
		{!data || isLoading || isFetching ? <CircularProgress/> : null}
		{data ? (
			<Sheet sx={{ display: 'flex', flexDirection: 'column', p: '5px 15px', gap: '15px', width: '100%', height: '100%' }}>
				<PageHeader title={flowId!} />             
				<ChartControl rows={[...barChartData].reverse()} data={[...lineChartData].reverse()} indices={indices}/>
				<ToolBar 
					controlledRows={data.runs} 
					updateRows={setSelData}
					searchColumn={'runId'}
					searchMode={'equals'}
					searchPlaceholder={'Search by Run ID'}
					filters={checkFiltersAvailability(data.runs, defaultFilters())}
					datetimePicker={handleDateRangeChange}
					/>
				<DataTable data={selData} columns={columns} navigator={(row) => `${currURL}/${row.runId}/${row.attemptId}/timeline`} keyAttr='id'/>
			</Sheet>   
		):(<NotFound errorType={500}/>)
	}
	</>);
}
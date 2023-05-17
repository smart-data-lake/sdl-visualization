import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import RunsHistoryTable from "./WorkflowHistoryTable";
import { CircularProgress, Sheet } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import { useEffect, useState } from "react";
import { TablePagination } from "@mui/material";
import ChartControl from "../HistoryChart/ChartControl";
import { durationMicro, getISOString } from "../../../util/WorkflowsExplorer/date";
import WorkflowDetails from "./WorkflowDetails";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import IconButton from '@mui/joy/IconButton';
import { checkFiltersAvailability, defaultFilters } from "../../../util/WorkflowsExplorer/StatusInfo";


export type Indices = {
	toDisplayLeft: number, 
	toDisplayRight?: number, 
	rangeLeft?: number, 
	rangeRight?: number
}

/**
 * The WorkflowHistory component is the page that displays the history of a workflow as a table.
 * It allows the user to filter according to different filters/search/sort criteria passed to the ToolBar component.
 * @returns JSX.Element
*/
const WorkflowHistory = () => {
	const links = [...useLocation().pathname.split('/')].splice(1);
	const workflowName :  string= links[links.length - 1];
	const { data, isLoading, isFetching } = useFetchWorkflow(workflowName);
	const [rows, setRows] = useState<any[]>([]);
	const [toDisplay, setToDisplay] = useState<any[]>(rows);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(25);
	const [count, setCount] = useState(0);
	const [barChartData, setBarChartData] = useState<any[]>([])
	const [lineChartData, setLineChartData] = useState<any[]>([])
	const [indices, setIndices] = useState<Indices>({toDisplayLeft: 0, toDisplayRight: rowsPerPage})
	const [open, setOpen] = useState<Boolean>(true)
	const [startDate, setStartDate] = useState<Date>(new Date(0))
	const [endDate, setEndDate] = useState<Date>(new Date())
	const [pieChartData, setPieChartData] = useState<any[]>([])
	
	useEffect(() => {
		if (!isLoading) {
			updateRows(data.runs);
			setCount(rows.length)
			setLineChartData(generateChartData(data.runs))
			setPieChartData(lineChartData)
		}
	}, [data])
	
	useEffect(() => {
		setToDisplay(rows.slice(0, rowsPerPage));
		setCount(rows.length)
		setIndices({toDisplayLeft: page*rowsPerPage, toDisplayRight: (page+1)*rowsPerPage, rangeLeft: indices?.rangeLeft, rangeRight: indices?.rangeRight})
	}, [rows])

	useEffect(() => {
		setBarChartData(generateChartData(toDisplay))
	}, [toDisplay])
	
	const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setRowsPerPage(parseInt(event.target.value, 10));
		setPage(0);
		setToDisplay(rows.slice(0, parseInt(event.target.value, 10)));
	}
	
	const handleChangePage = (_: any, newPage: number,) => {
		setPage(newPage);
		setToDisplay(rows.slice(newPage*rowsPerPage, newPage*rowsPerPage + rowsPerPage));
		setIndices({toDisplayLeft: page*rowsPerPage, toDisplayRight: (page+1)*rowsPerPage, rangeLeft: indices?.rangeLeft, rangeRight: indices?.rangeRight})
	}

	const updateRows = (rows: any[]) => {
		setRows(rows.sort(cmp));
	}

	const cmp = (a: any, b: any) => {
		return new Date(b.attemptStartTime).getTime() - new Date(a.attemptStartTime).getTime();
	}

	const handleDateRangeChange = (start: Date, end: Date) => {
		setStartDate(start)
		setEndDate(end)
		const filteredRows = data.runs.filter((row) => {
			const date = new Date(row.attemptStartTime)
			return date >= start && date <= end
		})
		updateRows(filteredRows)
		let rangeRight = 0;
		
		for (let i = 0; i < data.runs.length; i++) {
			if (filteredRows[0].attemptStartTime === data.runs[i].attemptStartTime) {
				rangeRight = i;
				break;
			}
		}
		setIndices({toDisplayLeft: indices.toDisplayLeft, toDisplayRight: indices.toDisplayRight, rangeLeft: data.runs.length - (rangeRight + filteredRows.length), rangeRight: data.runs.length - 1 - rangeRight})
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
			res.push(
				{
					value: durationMicro(run.duration),
					status: run.status,
					name: run.attemptStartTime,
					runId: run.runId,
					attemptId: run.attemptId    
				}
			)
		});
		return res;
	}

	if (isLoading || isFetching) return (<CircularProgress/>)

	return (
		<>
			<PageHeader title={workflowName} />             
				<Sheet
					sx={{
						display: 'flex',
						height: '85vh'
					}}
				>
					<Sheet
						sx={{
							pt: '1rem',
							pr: '1rem',
							flex: 3,
							scrollbarWidth: 'none',
							overflowY: 'scroll', 
						}}
					>                   
						<ChartControl rows={[...barChartData].reverse()} data={[...lineChartData].reverse()} indices={indices}/>
						<ToolBar 
							style={'horizontal'} 
							controlledRows={data.runs} 
							sortEnabled={true}
							updateRows={updateRows}
							searchColumn={'runId'}
							searchMode={'exact'}
							searchPlaceholder={'Search by Run ID'}
							filters={checkFiltersAvailability(data.runs, defaultFilters())}
							datetimePicker={handleDateRangeChange}
							/>
						<Sheet sx={{
							mt: '1rem',
							width: '100%',
							}}
						>
							<RunsHistoryTable data={toDisplay}/>
						</Sheet>
						<Sheet
							sx={{
								position: 'sticky',
								bottom: 0,
							}}
						>
							<TablePagination
								
								rowsPerPageOptions={[10, 25, 50, 100]}
								rowsPerPage={rowsPerPage}
								page={page}
								SelectProps={{
								inputProps: {
									'aria-label': 'rows per page',
								},
								native: true,
								}}
								onPageChange={handleChangePage}
								onRowsPerPageChange={handleChangeRowsPerPage}
								component="div"
								count={count}
							/> 
						</Sheet>
					</Sheet>
					{open && (
						<>
						<Sheet>
						<IconButton sx={{mt: '1rem'}} variant='plain' color='neutral' onClick={() => setOpen(!open)}>
							<ChevronRightIcon />
						</IconButton>
						</Sheet>
						<Sheet
						sx={{
							flex: 1,
							pt: '2rem',
							pl: '1rem',
							borderLeft: '1px solid lightgray',
						}}
						>
							<WorkflowDetails data={data} pieChartData={pieChartData}/>
						</Sheet>
							</>
					)}
					{!open && (
						<Sheet>
							<IconButton sx={{mt: '1rem'}} variant='plain' color='neutral' onClick={() => setOpen(!open)}>
								<ChevronLeftIcon />
							</IconButton>
						</Sheet>	
					)}
			</Sheet>
						
		</>   
	);
}
 
export default WorkflowHistory;
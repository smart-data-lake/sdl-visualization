import { useLocation } from "react-router-dom";
import PageHeader from "../../../layouts/PageHeader";
import { CircularProgress, Sheet } from "@mui/joy";
import ToolBar from "../ToolBar/ToolBar";
import { useFetchWorkflow } from "../../../hooks/useFetchData";
import { useEffect, useState } from "react";
import { TablePagination } from "@mui/material";
import ChartControl from "../HistoryChart/ChartControl";
import { durationMicro } from "../../../util/WorkflowsExplorer/date";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import IconButton from '@mui/joy/IconButton';
import { checkFiltersAvailability, defaultFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import WorkflowHistoryTable from "./WorkflowHistoryTable";
import NotFound from "../../../layouts/NotFound";


export type Indices = {
	toDisplayLeft: number, 
	toDisplayRight?: number, 
	rangeLeft?: number, 
	rangeRight?: number,
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
	const [open, setOpen] = useState<Boolean>(false)
	
	
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

	const updateRows = (rows?: any[], cmp?: (a: any, b: any) => number) => {
		const cmpAlgorithm = cmp ? cmp : defaultCmp;
		const targetRows = rows ? rows : data.runs;
		setRows(targetRows.sort(cmpAlgorithm));
	}
	
	const defaultCmp = (a: any, b: any) => {
		return new Date(b.attemptStartTime).getTime() - new Date(a.attemptStartTime).getTime();
	}
	
	const handleDateRangeChange = (start: Date, end: Date) => {
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

		useEffect(() => {
			if (!isLoading && !data.detail) {
				updateRows(data.runs);
				setCount(rows.length)
				setLineChartData(generateChartData(data.runs))
			} else if (!isLoading && data.detail) {
				setRows([]);
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

		
		if (isLoading || isFetching) return (<CircularProgress/>)
		if (process.env.NODE_ENV === 'development' && data.detail) console.log(data.detail);

		return (
			<>
			{!data || isLoading || isFetching ? <CircularProgress/> : null}
			{data ? (
				(!data.detail) ? (
					<>
						<PageHeader title={workflowName} />             
						<Sheet
							sx={{
								display: 'flex',
							}}
						>
							<Sheet
								sx={{
									px: '1rem',
									flex: 3,
								}}
							>                   
								<ChartControl rows={[...barChartData].reverse()} data={[...lineChartData].reverse()} indices={indices}/>
								<ToolBar 
									controlledRows={data.runs} 
									sortEnabled={false}
									updateRows={updateRows}
									searchColumn={'runId'}
									searchMode={'equals'}
									searchPlaceholder={'Search by Run ID'}
									filters={checkFiltersAvailability(data.runs, defaultFilters())}
									datetimePicker={handleDateRangeChange}
									/>
								<Sheet sx={{
									mt: '1rem',
									width: '100%',
									display: 'flex',
									}}
								>
									<WorkflowHistoryTable data={toDisplay} updateRows={updateRows}/>
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
									{/* <WorkflowDetails data={data} pieChartData={pieChartData}/> */}
								</Sheet>
									</>
							)}
							{!open && (
								<Sheet>
									<IconButton disabled sx={{mt: '1rem'}} variant='plain' color='neutral' onClick={() => setOpen(!open)}>
										<ChevronLeftIcon />
									</IconButton>
								</Sheet>	
							)}
						</Sheet>
									
					</>   
					):(
						<>
							<NotFound errorType={500}/>
						</>
					)
				):(
					<>
						<NotFound/>
					</>
				)
			}
		</>
	);
}
 
export default WorkflowHistory;
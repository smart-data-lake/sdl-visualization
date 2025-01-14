import { ListItemDecorator, Select, Typography } from "@mui/joy";
import React from "react";
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import Option from '@mui/joy/Option';
import { SortType } from "../../../types";

/**
 * The SelectSort component is a subcomponent of the ToolBar component that implements the sort functionality.
 * It updates the sort type that is passed to it based on the user's input using the updateSort function.
 * @param props.updateSort - function that updates the sort type
 * @returns JSX.Element
 */
const SelectSort = (props: {updateSort: (sort: SortType) => void}) => {
	const { updateSort } = props;

  	return (
  	  	<Select
			size="sm"
			variant="outlined"
			color="primary"
			defaultValue={'start time asc'}
	  	  	placeholder="Sort by"
			onChange={(_, v) => updateSort(v as SortType)}
			sx={{minWidth: '9rem'}}
	  	>
	  	  	<Option value="start time asc">
				<ListItemDecorator>
					<ArrowUpwardIcon/>
				</ListItemDecorator>
				<Typography sx={{ml: '0.5rem'}}>
					Start time
				</Typography>
			</Option>
	  	  	<Option value="start time desc">
				<ListItemDecorator>
					<ArrowDownwardIcon/>
				</ListItemDecorator>
				<Typography sx={{ml: '0.5rem'}}>
					Start time
				</Typography>
			</Option>
  	  	</Select>
  	);
}

export default SelectSort;
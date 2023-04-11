import { Box, Input } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { Row, SortType } from "../../../types";
import { sortRows } from "../../../util/WorkflowsExplorer/row";
import FilterMenu from "./FilterMenu";
import SelectSort from "./SelectSort";



const ToolBar = (props: {controlledRows: any[], updateRows: (rows: any[]) => void, style?: 'horizontal' | 'vertical', filters?: {name: string, fun: (rows: Row[]) => any}[]}) => {
    const { controlledRows, updateRows, filters } = props;
	const [value, setValue] = useState<string>('');
	const [list, setList] = useState<boolean[]>(Array(filters?.length).fill(true));
    const [sort, setSort] = useState<SortType>('start time asc');
	const style = props.style ? props.style : 'vertical';

	const updateList = (list: boolean[]) => {
		setList(list);
	}

	const updateSort = (sort: SortType) => {
		setSort(sort);
	}

	useEffect(() => {
		function handleInput() {
			return controlledRows.filter((row) => row.step_name.toLowerCase().includes(value.toLowerCase()));
		}
		
		function applyFilters() {
			const filteredRows: any[] = []
			list.map((item, index) => {
				if (item && filters) filteredRows.push(...filters[index].fun(controlledRows));
			});
			return filteredRows;
		}
		
		const a = handleInput();
		const b = applyFilters(); 
		const c = a.filter((row) => b.includes(row));
		updateRows(sortRows(c, sort));
	}, [value, list, sort]);
	
    if (style === 'vertical') return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: 'lightgray',
                borderRadius: '0.5rem',
                height: '90%',
                maxWidth: '15rem',
              }}
        >
            <Box sx={{m: '1rem'}}>
                <Input
                    placeholder="Search"
                    required
                    sx={{ mb: 0, fontSize: 'var(--joy-fontSize-sm)' }}
                    onChange={(event) => {
                        const { value } = event.target;
                        setValue(value)
                    }}
                />
				<SelectSort updateSort={updateSort}/>
                {filters && <FilterMenu filters={filters} updateList={updateList}/>}
            </Box>
        </Box>
    );

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'right',
                mt: '2rem',
                mb: '1rem',
                gap: '1rem'
            }}
        >
                <Input
                    placeholder="Search"
                    required
                    sx={{ mb: 0, fontSize: 'var(--joy-fontSize-sm)' }}
                    onChange={(event) => {
                        const { value } = event.target;
                        setValue(value)
                    }}
                />
				<SelectSort updateSort={updateSort}/>
                {filters && <FilterMenu filters={filters} updateList={updateList}/>}
        </Box>
    )
}

export default ToolBar;
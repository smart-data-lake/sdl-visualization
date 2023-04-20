import { Box, Input } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { Row, SortType } from "../../../types";
import { sortRows } from "../../../util/WorkflowsExplorer/row";
import FilterMenu from "./FilterMenu";
import SelectSort from "./SelectSort";


/**
 * The ToolBar component is a component that implements various search, filter and sort functions.
 * It updates the rows that are passed to it based on predefined filters and the user's input.
 * @param props.controlledRows - rows to be filtered, the rows that are passed to the ToolBar component and represent the complete information we can search of filter on.
 * @param props.filter - filters to be applied, they are passed and used by the FilterMenu component, which is a subcomponent of the ToolBar component that update the rows based on the filters using the updateRows function.
 * @param props.style - style of the toolbar
 * @returns JSX.Element
 */
const ToolBar = (
    props: {
        controlledRows: any[], 
        updateRows: (rows: any[]) => void, 
        searchColumn: string,
        style?: 'horizontal' | 'vertical', 
        filters?: {name: string, fun: (rows: any[]) => any}[]
    }) => {
    const { controlledRows, updateRows, searchColumn, filters } = props;
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
            const tmp = controlledRows.filter((row) => row[searchColumn].toString().toLowerCase().includes(value.toLowerCase()));
            return tmp;
		}
		
		function applyFilters() {
			const filteredRows: any[] = []
			list.map((item, index) => {
				if (item && filters) filteredRows.push(...filters[index].fun(controlledRows));
			});
			return filteredRows;
		}
		
		const a = handleInput();
        let b : any;
        if (filters && filters.length > 0) {
            b = applyFilters(); 
        } else {
            b = controlledRows;
        }
		const c = a.filter((row) => b.includes(row));
		updateRows(sortRows(c, sort));
	}, [value, list, sort]);
	
    if (style === 'vertical') return (
        <Box
            sx={{
                height: '85vh',
                maxWidth: '17rem',
              }}
        >
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
            }}>
                <Input
                    placeholder="Search"
                    required
                    sx={{ mb: 0, fontSize: 'var(--joy-fontSize-sm)' }}
                        onChange={(event) => {
                            const { value } = event.target;
                            setValue(value)
                        }
                    }
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
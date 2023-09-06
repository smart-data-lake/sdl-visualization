import { Box, Divider, Input, Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import { Filter } from "../../../util/WorkflowsExplorer/StatusInfo";
import DatetimePicker from "../DatetimePicker/DatetimePicker";
import FilterMenu from "./FilterMenu";
import Phases from "./Phases";


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
        filters: Filter[],
        datetimePicker?: (start: Date, end: Date) => void,
        searchMode?: 'equals' | 'contains',
        searchPlaceholder?: string,
        updateChecked?: (phases: {name: string, checked: boolean}[]) => void
        phases?: boolean
    }) => {
    const { controlledRows, updateRows, searchColumn, filters, datetimePicker, searchMode, searchPlaceholder, updateChecked } = props;
	const [value, setValue] = useState<string>('');
	const [list, setList] = useState<boolean[]>(Array(filters?.length).fill(true));
	const style = props.style ? props.style : 'horizontal';

	const updateList = (list: boolean[]) => {
		setList(list);
	}

    const updatePhases = (checked: { name: string; checked: boolean; }[]) => {
        if (updateChecked) updateChecked(checked);
    }

	useEffect(() => {
		function handleInput(data: any[]) {
            if (value.trim().length === 0) return data;
            else if (searchMode === 'equals') return data.filter((row) => row[searchColumn].toString().toLowerCase() === value.toLowerCase());
            else return data.filter((row) => row[searchColumn].toString().toLowerCase().includes(value.toLowerCase()));
        }
		
		function applyFilters(data: any[]) {
            const enabledFilters = filters.filter((_,idx) => list[idx]);
            if (filters.length === 0) return data;
            else return data.filter(row => enabledFilters.some(filter => filter.predicate(row)));
		}
		
        const filteredRows = applyFilters(handleInput(controlledRows));
		updateRows(filteredRows);
	}, [value, list]);

    if (style === 'vertical') return (
        <Box
            sx={{
                height: '100%',
                maxWidth: '17rem',
                border: '1px solid lightgray',
                borderRadius: '0.5rem',
              }}
        >
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                m: '1rem',
                gap: '1.5rem',
            }}>

                {filters && (
                        <>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Typography level="body-md">
                                    Status
                                </Typography>
                                <Divider/>
                                <FilterMenu filters={filters} updateList={updateList} mode={'vertical'}/>
                            </Box>
                        </>
                    )
                }
                <Input
                    placeholder="Search row"
                    size="sm"
                    sx={{fontSize: 'var(--joy-fontSize-sm)' }}
                        onChange={(event) => {
                            const { value } = event.target;
                            setValue(value)
                        }
                    }
                />
            </Box>
        </Box>
    );
    
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
            }}
            >
                <Input
                    placeholder={searchPlaceholder || "Search"}
                    size="sm"
                    sx={{fontSize: 'var(--joy-fontSize-sm)', zIndex: 'auto',}}
                    onChange={(event) => {
                        const { value } = event.target;
                        setValue(value)
                    }}
                />
                {filters && <FilterMenu filters={filters} updateList={updateList}/>}
                {updateChecked && <Phases updatePhases={updatePhases}/>}
                {datetimePicker && <DatetimePicker datetimePicker={datetimePicker}/>}
        </Box>
    )
}

export default ToolBar;
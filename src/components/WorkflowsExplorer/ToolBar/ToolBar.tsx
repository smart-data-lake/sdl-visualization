import { Box, Input } from "@mui/joy";
import { Filter, phaseFilters } from "../../../util/WorkflowsExplorer/StatusInfo";
import DatetimePicker from "../DatetimePicker/DatetimePicker";
import { getPhasesColor, getStatusColor } from "../Timeline/TimelineRow/utils";
import { FilterParams } from "../WorkflowHistory";
import FilterMenu from "./FilterMenu";


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
        data: any[], 
        filterParams: FilterParams,        
        updateFilterParams: (params: Partial<FilterParams>) => void,
        stateFilters: Filter[],
        datetimePicker?: boolean,
        searchPlaceholder?: string,
        setPhases?: (phases: string[]) => void
    }) => {
    const { data, filterParams, updateFilterParams, stateFilters, datetimePicker, searchPlaceholder, setPhases } = props;

    function setSearchText(text: string) {
        const searchText = (text.trim().length > 0 ? text.trim() : undefined);    
        updateFilterParams({searchText: searchText})    
    }
		
    function setStateFilters(filters: Filter[]) {
        const otherFilters = filterParams.additionalFilters.filter(f => f.group != 'state');
        const newAdditionalFilters = otherFilters.concat(filters);
        updateFilterParams({additionalFilters: newAdditionalFilters})    
    }

    function setDateRange(range?: [Date,Date]) {
        updateFilterParams({dateRange: range})    
    }    
    
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Input
                placeholder={searchPlaceholder || "Search"}
                size="sm"
                sx={{fontSize: 'var(--joy-fontSize-sm)', zIndex: 'auto',}}
                onChange={(event) => setSearchText(event.target.value)}
            />
            {stateFilters && <FilterMenu title='Filter Status' filters={stateFilters} setFilters={setStateFilters} colorMap={getStatusColor} withIcon={true}/>}
            {setPhases && <FilterMenu title='Select Phases' filters={phaseFilters} setFilters={filters => setPhases(filters.map(f => f.name))} filterInit={[false,false,true]} colorMap={getPhasesColor}/>}
            {datetimePicker && <DatetimePicker range={filterParams.dateRange} setRange={setDateRange}/>}
        </Box>
    )
}

export default ToolBar;
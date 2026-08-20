import { Box, Input } from "@mui/joy";
import { Filter } from "../../../util/WorkflowsExplorer/StatusInfo";
import DatetimePicker from "../DatetimePicker/DatetimePicker";
import { NEUTRAL_COLOR, getStatusColor } from "../../../util/WorkflowsExplorer/statusColors";
import { FilterParams } from "../WorkflowHistory";
import FilterMenu from "./FilterMenu";
import useLocalStorageState from "../../../hooks/useLocalStorageState";


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
        attemptFilters?: Filter[],
        datetimePicker?: boolean,
        searchPlaceholder?: string,
        storageKeyPrefix: string,
        leftElements?: JSX.Element,
        rightElements?: JSX.Element,
    }) => {
    const { data, filterParams, updateFilterParams, stateFilters, attemptFilters, datetimePicker, searchPlaceholder, storageKeyPrefix, leftElements, rightElements } = props;

    /*
      The selected filters are remembered per page, because the pages remount when their data is
      refreshed (see Run) and the selection would otherwise fall back to its default while the menus
      still showed it as set - issue #115.

      Only the *names* are stored: a Filter carries a predicate, which does not survive
      JSON.stringify, so the Filter objects are rebuilt from the definitions the page passes in.
      A name that the refreshed data has no filter for anymore is simply not found again.
    */
    const [selectedStates, setSelectedStates] = useLocalStorageState<string[] | undefined>(`${storageKeyPrefix}.filter.state`, undefined);
    const [selectedAttempts, setSelectedAttempts] = useLocalStorageState<string[] | undefined>(`${storageKeyPrefix}.filter.attempt`, undefined);

    function setSearchText(text: string) {
        const searchText = (text.trim().length > 0 ? text.trim() : undefined);    
        updateFilterParams({searchText: searchText})    
    }
		
    function setStateFilters(filters: Filter[]) {
        const otherFilters = filterParams.additionalFilters.filter(f => f.group != 'state');
        const newAdditionalFilters = otherFilters.concat(filters);
        setSelectedStates(filters.map(f => f.name));
        updateFilterParams({additionalFilters: newAdditionalFilters})
    }

    function setAttemptsFilters(filters: Filter[]) {
        const otherFilters = filterParams.additionalFilters.filter(f => f.group != 'attempt');
        const newAdditionalFilters = otherFilters.concat(filters);
        setSelectedAttempts(filters.map(f => f.name));
        updateFilterParams({additionalFilters: newAdditionalFilters})
    }

    function setDateRange(range?: [Date,Date]) {
        updateFilterParams({dateRange: range})    
    }    
    
    // restore the remembered selection, or enable only the last attempt by default
    const attemptFilterInit = (attemptFilters ? attemptFilters.map(_ => false) : []);
    if (attemptFilters) {
        if (selectedAttempts) {
            attemptFilters.forEach((f, idx) => attemptFilterInit[idx] = selectedAttempts.includes(f.name));
        } else {
            attemptFilterInit[attemptFilterInit.length -1] = true;
        }
    }

    // restore the remembered selection, or enable all states by default
    const stateFilterInit = stateFilters?.map(f => selectedStates ? selectedStates.includes(f.name) : true);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Input
                placeholder={searchPlaceholder || "Search"}
                size="sm"
                sx={{fontSize: 'var(--joy-fontSize-sm)', zIndex: 'auto',}}
                onChange={(event) => setSearchText(event.target.value)}
            />
            {attemptFilters && attemptFilters.length>1 && <FilterMenu title='Select Attempts' filters={attemptFilters} setFilters={setAttemptsFilters} filterInit={attemptFilterInit} colorMap={() => NEUTRAL_COLOR}/>}
            {stateFilters && <FilterMenu title='Filter Status' filters={stateFilters} setFilters={setStateFilters} filterInit={stateFilterInit} colorMap={getStatusColor} withIcon={true}/>}
            {datetimePicker && <DatetimePicker range={filterParams.dateRange} setRange={setDateRange}/>}
            {leftElements && leftElements}
            <Box sx={{flex: 1}}/>
            {rightElements && rightElements}
        </Box>
    )
}

export default ToolBar;
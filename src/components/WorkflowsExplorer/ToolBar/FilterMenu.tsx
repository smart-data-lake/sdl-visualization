import { Box, Button, Checkbox, Dropdown, ListDivider, Menu, MenuButton, MenuItem, Sheet } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { Filter, getIcon, getStatusColor } from "../../../util/WorkflowsExplorer/StatusInfo";

/**
 * The FilterMenu component is a subcomponent of the ToolBar component that implements the filter functionality.
 * It updates the list of filters that are passed to it based on the user's input.
 * Using the updateList function, the list of filters is passed to the ToolBar component, which uses it to update the rows.
 * @param props.updateList - function that updates the list of filters
 * @param props.style - style of the menu
 * @param props.filters - filters to be applied
 * @returns 
 */
const FilterMenu = (props: {title: string, setFilters: (filters: Filter[]) => void, filters: Filter[]}) => {
    const { filters, setFilters, title } = props;
    const [list, setList] = useState<boolean[]>(Array(props.filters?.length).fill(true));

	useEffect(() => {
		setFilters(filters.filter((_,idx) => list[idx]));
	}, [list]);

    return (<>
        <Dropdown>
            <MenuButton size="sm" variant="outlined">{title}</MenuButton>               
            <Menu  size="sm">
                {filters && filters.map((filter, index) => (
                    <MenuItem color={getStatusColor(filter.name)}>
                        <Checkbox 
                            color={getStatusColor(filter.name.toUpperCase())}
                            size="sm"
                            variant="outlined"
                            checked={list[index]}
                            onChange={() => setList(list.map((item, i) => i === index ? !item : item))} 
                            sx={{ mr: '0.5rem' }}
                        /> 
                        {filter.name}
                        {getIcon(filter.name.toUpperCase())}
                    </MenuItem>                
                ))}
            </Menu>
        </Dropdown>
        </>
    );
  }

  export default FilterMenu;
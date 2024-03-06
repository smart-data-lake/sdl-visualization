import { Checkbox, Dropdown, Menu, MenuButton, MenuItem, Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import { Filter, getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";

/**
 * The FilterMenu component is a subcomponent of the ToolBar component that implements the filter functionality.
 * It updates the list of filters that are passed to it based on the user's input.
 * Using the updateList function, the list of filters is passed to the ToolBar component, which uses it to update the rows.
 * @param props.updateList - function that updates the list of filters
 * @param props.style - style of the menu
 * @param props.filters - filters to be applied
 * @returns 
 */
const FilterMenu = (props: {title: string, setFilters: (filters: Filter[]) => void, filters: Filter[], colorMap: (string) => string,  withIcon?: boolean, filterInit?: boolean[]}) => {
    const { filters, setFilters, title, withIcon, colorMap, filterInit } = props;
    const [list, setList] = useState<boolean[]>(filterInit || Array(props.filters?.length).fill(true));

	useEffect(() => {
		setFilters(filters.filter((_,idx) => list[idx]));
	}, [list]);

    return (<>
        <Dropdown>
            <MenuButton size="sm" variant="outlined">{title}</MenuButton>               
            <Menu  size="sm">
                {filters && filters.map((filter, index) => (
                    <MenuItem key={index}>
                        <Checkbox
                            color="neutral"                
                            size="sm"
                            variant="outlined"
                            checked={list[index]}
                            onChange={() => setList(list.map((item, i) => i === index ? !item : item))} 
                            sx={{ mr: '0.5rem' }}
                        />
                        <Typography sx={{color: colorMap(filter.name)}}>{filter.name}</Typography>                        
                        {withIcon && getIcon(filter.name)}
                    </MenuItem>                
                ))}
            </Menu>
        </Dropdown>
        </>
    );
  }

  export default FilterMenu;
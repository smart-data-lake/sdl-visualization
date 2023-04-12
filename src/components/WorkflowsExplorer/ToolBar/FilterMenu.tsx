import { IconButton, Menu, MenuItem, Switch, Typography } from "@mui/joy";
import React, { useEffect, useState } from "react";
import FilterListIcon from '@mui/icons-material/FilterList';
import { Row } from "../../../types";

/**
 * The FilterMenu component is a subcomponent of the ToolBar component that implements the filter functionality.
 * It updates the list of filters that are passed to it based on the user's input.
 * Using the updateList function, the list of filters is passed to the ToolBar component, which uses it to update the rows.
 * @param props.updateList - function that updates the list of filters
 * @param props.style - style of the menu
 * @param props.filters - filters to be applied
 * @returns 
 */
const FilterMenu = (props: {updateList: (list: boolean[]) => void, style?: 'vertical' | ' horizontal', filters?: {name: string, fun: (rows: Row[]) => void}[]}) => {
    const { filters, updateList } = props;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [list, setList] = useState<boolean[]>(Array(props.filters?.length).fill(true));
    const open = Boolean(anchorEl);
    const style = props.style ? props.style : 'vertical';

	useEffect(() => {
		updateList(list);
	}, [list]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
  
    const handleClose = () => {
      setAnchorEl(null);
    };
  
    return (
      <div>
        <IconButton
          id="filter-menu-button"
          aria-controls={open ? 'filter-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          variant="outlined"
          color="neutral"
          onClick={handleClick}
        >
        	<FilterListIcon/>
        </IconButton>
        <Menu
          id="filter-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          aria-labelledby="filter-menu-button"
        >
            {filters && filters.map((filter, index) => (
                <MenuItem key={index}>
                    <Switch 
						size="sm"
						checked={list[index]}
						onChange={() => {
                        	setList(list.map((item, i) => i === index ? !item : item));
						}}
						sx={{
							mr: '0.5rem'
					}}/>
                    <Typography>
                        {filter.name}
                    </Typography>
                </MenuItem>
            ))}
        </Menu>
      </div>
    );
  }

  export default FilterMenu;
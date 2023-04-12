import { IconButton, Menu, MenuItem, Switch, Typography } from "@mui/joy";
import React, { useEffect, useState } from "react";
import FilterListIcon from '@mui/icons-material/FilterList';
import { Row } from "../../../types";


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
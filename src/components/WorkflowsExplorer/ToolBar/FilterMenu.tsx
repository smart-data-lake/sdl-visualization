import { Box, Checkbox, IconButton, Menu, MenuItem, Sheet, Stack, Switch, Typography } from "@mui/joy";
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
    const style = props.style ? props.style : 'horizontal';

	useEffect(() => {
		updateList(list);
	}, [list]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
  
    const handleClose = () => {
      setAnchorEl(null);
    };
    
    if (style === 'vertical') return (
        <Stack>

            {filters && filters.map((filter, index) => (
                <>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <Checkbox 
                            color={filter.name === 'Succeeded' ? 'success' : (filter.name === 'Cancelled' ? 'danger' : 'warning')}
                        	size="sm"
                            variant="soft"
                        	checked={list[index]}
                        	onChange={() => {
                            	setList(list.map((item, i) => i === index ? !item : item));
                            }}
                            sx={{
                                mr: '1rem'
                            }}
                            />
                        <Typography>
                            {filter.name}
                        </Typography>
                    </Box>
                        
                </>
            ))}
        </Stack>
    )

    return (
      <div>
          <Stack direction="row" spacing={2}>
            {filters && filters.map((filter, index) => (
                <>
                    <Sheet
                        color={filter.name === 'Succeeded' ? 'success' : (filter.name === 'Failed' || filter.name === 'Cancelled' ? 'danger' : 'warning')}
                        variant="outlined"
                        sx={{
                            p: '0.2rem',
                            px: '0.5rem',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >     
                        <Checkbox 
                            color={filter.name === 'Succeeded' ? 'success' : (filter.name === 'Failed' || filter.name === 'Cancelled' ? 'danger' : 'warning')}
                            size="sm"
                            variant="soft"
                            checked={list[index]}
                            onChange={() => {
                                setList(list.map((item, i) => i === index ? !item : item));
                            }}
                            sx={{
                                mr: '0.5rem'
                            }}
                            />
                        <Typography>
                            {filter.name}
                        </Typography>
                    </Sheet>
                    </>
            ))}
            </Stack>
      </div>
    );
  }

  export default FilterMenu;
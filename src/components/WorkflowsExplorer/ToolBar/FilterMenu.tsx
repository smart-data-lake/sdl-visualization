import { Box, Checkbox, IconButton, Menu, MenuItem, Sheet, Stack, Radio, Typography, Button } from "@mui/joy";
import React, { useEffect, useState } from "react";
import FilterListIcon from '@mui/icons-material/FilterList';
import { Row } from "../../../types";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { get } from "http";
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

    const getButtonColor = (name: string) => {
        return name === 'Succeeded' ? 'success' : (name === 'Failed' || name === 'Cancelled' ? 'danger' : 'warning')
    }

    const getIcon = (name: string) => {
        return name === 'Succeeded' ? <CheckCircleOutlineIcon sx={{ scale: '80%', ml: '0.5rem' }} /> : (name === 'Failed' || name === 'Cancelled' ? <HighlightOffIcon sx={{ scale: '80%', ml: '0.5rem' }} /> : <AutorenewIcon sx={{ scale: '80%', ml: '0.5rem' }} />)
    }
    
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
          <Sheet sx={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            Status:  
            {filters && filters.map((filter, index) => (
                <>
                    {/* <Sheet
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
                            variant="solid"
                            checked={list[index]}
                            onChange={() => {
                                setList(list.map((item, i) => i === index ? !item : item));
                            }}
                            sx={{
                                mr: '0.5rem'
                            }}
                            /> */}
                            <Sheet
                                color={getButtonColor(filter.name)}
                                variant="outlined"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    py: '0.25rem',
                                    px: '0.5rem',
                                    borderRadius: '0.5rem',
                                }}
                            >
                                    <Checkbox 
                                        color={filter.name === 'Succeeded' ? 'success' : (filter.name === 'Failed' || filter.name === 'Cancelled' ? 'danger' : 'warning')}
                                        size="sm"
                                        variant="outlined"
                                        checked={list[index]}
                                        onChange={() => {
                                            setList(list.map((item, i) => i === index ? !item : item));
                                        }} 
                                        sx={{
                                            mr: '0.5rem'
                                        }}
                                    /> 
                                    {filter.name}
                                    {getIcon(filter.name)}
                            </Sheet>
                   {/*  </Sheet> */}
                    </>
            ))}
            </Sheet>
      </div>
    );
  }

  export default FilterMenu;
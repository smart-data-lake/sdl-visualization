import { Button, Checkbox, Menu, Sheet } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { Row } from "../../../types";
import { getButtonColor, getIcon } from "../../../util/WorkflowsExplorer/StatusInfo";
/**
 * The FilterMenu component is a subcomponent of the ToolBar component that implements the filter functionality.
 * It updates the list of filters that are passed to it based on the user's input.
 * Using the updateList function, the list of filters is passed to the ToolBar component, which uses it to update the rows.
 * @param props.updateList - function that updates the list of filters
 * @param props.style - style of the menu
 * @param props.filters - filters to be applied
 * @returns 
 */
const FilterMenu = (props: {updateList: (list: boolean[]) => void, mode?: 'vertical' | ' horizontal', filters?: {name: string, fun: (rows: Row[]) => void}[]}) => {
    const { filters, updateList } = props;
    const [list, setList] = useState<boolean[]>(Array(props.filters?.length).fill(true));
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [, setSelectedIndex] = React.useState<number>(1);

    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const createHandleClose = (index: number) => () => {
        setAnchorEl(null);
        if (typeof index === 'number') {
            setSelectedIndex(index);
        }
    };

	useEffect(() => {
		updateList(list);
	}, [list]);


    return (
        <Button 
            size="sm" 
            onClick={handleClick}
            aria-controls={open ? 'selected-demo-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            variant="outlined"
            disabled={filters?.length ? (filters.length < 2) : true}
        >
            Filter Status
            
            <Menu
                id="selected-demo-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={createHandleClose(-1)}
                aria-labelledby="selected-demo-button"
            >
                {filters && filters.map((filter, index) => (
                <>
                    <Sheet
                        color={getButtonColor(filter.name)}
                        variant="plain"
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
                                color={getButtonColor(filter.name.toUpperCase())}
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
                            {getIcon(filter.name.toUpperCase())}
                    </Sheet>
                </>
            ))}
            </Menu>
        </Button>
    );
  }

  export default FilterMenu;
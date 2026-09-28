import { AlignVerticalTop, Apps, ArrowDropDown, Clear, FitScreen, OpenInFull, Search, FilterList, UnfoldLess, UnfoldMore } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import BubbleChartOutlined from '@mui/icons-material/BubbleChartOutlined';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import {CloudDownload, Close} from '@mui/icons-material';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import HubOutlined from '@mui/icons-material/HubOutlined';
import SchemaIcon from '@mui/icons-material/Schema';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import ToggleButtonGroup from '@mui/joy/ToggleButtonGroup';
import * as React from 'react';
import { ReactElement } from 'react';

import { Autocomplete, Button, Divider, Dropdown, IconButton, Input, ListDivider, ListItemDecorator, ListSubheader, Menu, MenuButton, MenuItem, Tooltip, Checkbox, Select, Option } from '@mui/joy';
// import Option from '@mui/joy/Option';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Node as ReactFlowNode, useReactFlow } from 'reactflow';
import { LayoutChoice, nodeAttributes, useLineageGraph, useLineagePanel } from '../../../hooks/useLineage';
import { flowProps, resetLayout, resetViewPort, resetViewPortCentered, revealGroupMember, setAllGroupBoxesCollapsed } from '../../../util/ConfigExplorer/LineageTabUtils';
import { GROUP_ATTRIBUTE_LABELS, GroupAttribute, isGroupBox, isGrouping } from '../../../util/ConfigExplorer/Grouping';
import { GROUP_ATTRIBUTE_ICONS } from './GroupBoxNode';

/*
  Styling
*/
const componentZIndex = 4;
const styles = { zIndex: componentZIndex, cursor: 'pointer' }

/*
  helper function for image downloading
*/
function downloadImage(dataUrl: string) {
    const a = document.createElement('a');
    a.setAttribute('download', 'lineage.png');
    a.setAttribute('href', dataUrl);
    a.click();
}

function GraphViewSelector({props}: {props: flowProps}) {
    const { graphView, setGraphView, layoutChoice, setLayout } = useLineageGraph();

    const options = {
        full: {title: 'show full graph', icon: SchemaIcon},
        data: {title: 'show data graph', icon: TableViewTwoTone},
        action: {title: 'show action graph', icon: RocketLaunchOutlined},
        relations: {title: 'show relations between data objects', icon: HubOutlined},
    }

    // nothing to show when the configuration declares no foreign key, which is the common case
    const hasRelations = (props.configData?.relationsGraph?.edges.length ?? 0) > 0;

    const handleSelect = (value) => {
        setGraphView(value);
        /*
            An entity relation diagram is drawn left to right, and so are the relations: a column
            handle is on the left or the right border of its row, so in a top to bottom layout the
            edges would leave a node's lower border only to come back into the next node's left one.
            The layout button still switches it back for anyone who wants that.
        */
        if (value === 'relations') setLayout('LR');
        // the other views are a flow, which only a layered layout draws
        else if (layoutChoice === 'force') setLayout('LR');
    };

    /*
        The view that is shown is the one in the context, not one this component remembers: the
        lineage tab re-creates the whole flow, and the toolbar with it, on every settings change, so
        anything kept here would be back to its initial value while the graph shows something else.

        The items carry an icon and nothing else, so they centre it rather than laying it out from
        the left the way a menu item with a label does.
    */
    const createTooltip = (identifier, options, disabled = false) => {
        const title = options[identifier]['title']
        const Icon = options[identifier]['icon']

        return (
            <MenuItem selected={graphView === identifier} disabled={disabled}
                      onClick={() => { if (!disabled) handleSelect(identifier); }}
                      sx={{ justifyContent: 'center' }}>
                <Tooltip arrow title={disabled ? title + ' (no foreign keys are configured)' : title}
                         enterDelay={500} enterNextDelay={500} placement='right'>
                    <Icon />
                </Tooltip>
            </MenuItem>
        )
    }

    const ToolbarIcon = options[graphView]?.icon

    return (
        <Dropdown >
            <MenuButton endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1 }}>
                <Tooltip arrow title='Show graph view options' enterDelay={500} enterNextDelay={500} placement='top'>
                    <ToolbarIcon />
                </Tooltip>
            </MenuButton>
            <Menu>
                {createTooltip('full', options)}
                {createTooltip('data', options)}
                {createTooltip('action', options)}
                {createTooltip('relations', options, !hasRelations)}
            </Menu>
        </Dropdown>
    )
}


/* The layout: layered in either direction, or force directed, which only the relations view offers. */
function LayoutSelector({forceAvailable}: {forceAvailable: boolean}) {
    const { layoutChoice, setLayout } = useLineageGraph();

    const options: Record<LayoutChoice, {title: string, icon: typeof AlignVerticalTop}> = {
        TB: {title: 'vertical layout', icon: AlignVerticalTop},
        LR: {title: 'horizontal layout', icon: AlignHorizontalLeft},
        force: {title: 'force directed layout', icon: BubbleChartOutlined},
    };

    const item = (choice: LayoutChoice, disabled = false) => {
        const Icon = options[choice].icon;
        return (
            <MenuItem key={choice} selected={layoutChoice === choice} disabled={disabled} data-testid={`layout-${choice}`}
                      onClick={() => { if (!disabled) setLayout(choice); }} sx={{ justifyContent: 'center' }}>
                <Tooltip arrow title={disabled ? options[choice].title + ' (only in the relations view)' : options[choice].title}
                         enterDelay={500} enterNextDelay={500} placement='right'>
                    <Icon />
                </Tooltip>
            </MenuItem>
        );
    };

    const ToolbarIcon = options[layoutChoice].icon;

    return (
        <Dropdown>
            <MenuButton endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1 }}
                        data-testid='layout-selector'>
                <Tooltip arrow title='Show layout options' enterDelay={500} enterNextDelay={500} placement='top'>
                    <ToolbarIcon />
                </Tooltip>
            </MenuButton>
            <Menu>
                {item('TB')}
                {item('LR')}
                {item('force', !forceAvailable)}
            </Menu>
        </Dropdown>
    );
}

function GraphExpansionButton() {
    const { isExpanded, setIsExpanded } = useLineageGraph();

    return <Tooltip arrow title={isExpanded ? 'Collapse graph' : 'Expand graph'} enterDelay={500} enterNextDelay={500} placement='top'>
        <IconButton
            color='neutral'
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {isExpanded ? <CloseFullscreenIcon /> : <OpenInFull />}
        </IconButton>
    </Tooltip>
}

function DownloadLineageButton() {
    const download = () => {
        toPng(document.querySelector('.react-flow') as HTMLElement, {
            filter: (node) => {
                // don't include minimap, the controls and the MUI Buttons.
                return (
                    !node?.classList?.contains('react-flow__minimap') &&
                    !node?.classList?.contains('react-flow__controls') &&
                    !node?.classList?.contains('MuiSvgIcon-root') &&
                    !node?.classList?.contains('MuiButtonBase-root'))
            },
        }).then(downloadImage);
    };

    return (
        <Tooltip arrow title='Download image as PNG file' enterDelay={500} enterNextDelay={500} placement='top'>
            <IconButton sx={{ display: "flex", flexDirection: "column" }}
                color='neutral'
                onClick={download}>
                <CloudDownload />
                {/* <Typography variant='plain' sx={{ fontSize: '0.55rem' }}>download</Typography> */}
            </IconButton>
        </Tooltip>
    );
}

function CloseLineageButton() {
    const { setLineageTabOpen } = useLineagePanel();
    const closeLineage = () => {
        setLineageTabOpen(false)
    }
    return (
        <Tooltip arrow title='Close lineage' enterDelay={500} enterNextDelay={500} placement='top'>
            <IconButton sx={{ display: "flex", flexDirection: "column"}}
                color='neutral'
                onClick={closeLineage}>
                <Close />
            </IconButton>
        </Tooltip>
    )
}

function ShowAllButton() {
    const rfi = useReactFlow();
    const handleOnClick = () => {
        resetViewPort(rfi);
    }

    return (
        <Tooltip arrow title='Show all' enterDelay={500} enterNextDelay={500} placement='top'>
            <IconButton onClick={handleOnClick}>
                <FitScreen />
            </IconButton>
        </Tooltip>
    )
}

function CenterFocusButton() {
    const rfi = useReactFlow();
    const handleOnClick = () => {
        const nodes = rfi.getNodes();
        resetViewPortCentered(rfi, nodes);
    }
    return (
        <Tooltip arrow title='Focus on central node' enterDelay={500} enterNextDelay={500} placement='top'>
            <IconButton onClick={handleOnClick}>
                <FilterCenterFocusIcon />
            </IconButton>
        </Tooltip>
    )
}

function ResetLayoutButton() {
    const rfi = useReactFlow();
    const { layout: layoutDirection } = useLineageGraph();

    // the nodes shown stay; their columns close and the manual moves are given up
    const handleOnClick = () => {
        resetLayout(rfi, layoutDirection);
    }

    return (
        <Tooltip arrow title='Reset layout' enterDelay={500} enterNextDelay={500} placement='top'>
            <IconButton onClick={handleOnClick}>
                <Apps />
            </IconButton>
        </Tooltip>
    )
}

// box the nodes by an attribute along and across the flow; changing it rebuilds the node set, like the layout direction
function GroupingButton() {
    const rfi = useReactFlow();
    const { graphView, layout, layoutMode, grouping, setGrouping } = useLineageGraph();
    // foreign keys are not a flow, and a force layout has no lanes or columns to keep boxes apart
    const unavailable = graphView === 'relations' || layoutMode === 'force';

    const [open, setOpen] = React.useState(false);
    const handleOpenChange = React.useCallback((_event: React.SyntheticEvent | null, isOpen: boolean) => setOpen(isOpen), []);

    const option = (axis: 'along' | 'across', attribute: GroupAttribute | undefined) => {
        const Icon = attribute ? GROUP_ATTRIBUTE_ICONS[attribute] : Clear;
        return (
            <MenuItem key={`${axis}-${attribute ?? 'none'}`} selected={grouping[axis] === attribute}
                      onClick={() => setGrouping({...grouping, [axis]: attribute})} sx={{ outline: '0 !important' }}>
                <ListItemDecorator><Icon/></ListItemDecorator>
                {attribute ? GROUP_ATTRIBUTE_LABELS[attribute] : 'None'}
            </MenuItem>
        );
    };

    return (
        <Dropdown open={open} onOpenChange={handleOpenChange}>
            <MenuButton disabled={unavailable} endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />}
                        sx={{ padding: 1, outline: '0 !important' }} aria-label='Grouping'>
                <Tooltip arrow title={unavailable ? 'Grouping needs a layered layout of a flow' : 'Group nodes into boxes'}
                         enterDelay={500} enterNextDelay={500} placement='top'>
                    <WorkspacesIcon color={isGrouping(grouping) ? 'primary' : undefined}/>
                </Tooltip>
            </MenuButton>
            {/* dense: a small list with tight rows, headers and dividers */}
            <Menu size="sm" sx={{'--ListItemDecorator-size': '24px', '--ListItem-minHeight': '26px', '--ListDivider-gap': '2px',
                                 '--ListItem-paddingY': '0px', py: 0.5, '& .MuiSvgIcon-root': {fontSize: 18}}}>
                <ListSubheader sx={{minHeight: '22px'}}>{layout === 'LR' ? 'Rows' : 'Columns'} along the flow</ListSubheader>
                {option('along', undefined)}
                {option('along', 'feed')}
                {option('along', 'subjectArea')}
                <ListDivider/>
                <ListSubheader sx={{minHeight: '22px'}}>{layout === 'LR' ? 'Columns' : 'Rows'} across the flow</ListSubheader>
                {option('across', undefined)}
                {option('across', 'layer')}
                <ListDivider/>
                <MenuItem disabled={!isGrouping(grouping)} onClick={() => setAllGroupBoxesCollapsed(rfi, true, layout)}>
                    <ListItemDecorator><UnfoldLess/></ListItemDecorator>Collapse all
                </MenuItem>
                <MenuItem disabled={!isGrouping(grouping)} onClick={() => setAllGroupBoxesCollapsed(rfi, false, layout)}>
                    <ListItemDecorator><UnfoldMore/></ListItemDecorator>Expand all
                </MenuItem>
            </Menu>
        </Dropdown>
    )
}

function NodeAttributeSelector() {
    const { selectedNodeAttributes: selected, setSelectedNodeAttributes } = useLineageGraph();

    const handleChange = (_, newValue) => {
        setSelectedNodeAttributes(newValue);
    };

    // Divide attributes into data and action node attributes
    const dataNodeAttributes = nodeAttributes.filter(attr => attr.value.startsWith("data"))
    const actionNodeAttributes = nodeAttributes.filter(attr => attr.value.startsWith("action"))

    return (
        <Tooltip
            arrow
            title={<>Select which attributes should be shown for the displayed nodes.</>}
            enterDelay={500}
            enterNextDelay={500}
            placement='top'
        >
            <Select
                multiple
                value={selected}
                onChange={handleChange}
                startDecorator={<FilterList />}
                variant="plain" // Do not show shadow box
                placeholder=""
                renderValue={() => null} // Do not display selected items
                className = 'attribute-selection-dropdown-parent'
                slotProps={{
                    // Set class on <ul> for CSS selector
                    listbox: {
                        className: 'attribute-selection-dropdown',
                    }
                }}
            >
                {dataNodeAttributes.map(attr => (
                    <Option key={attr.value} value={attr.value} >
                        <Checkbox checked={selected.includes(attr.value)} />
                        {attr.label}
                    </Option>
                ))}
                <Divider/>
                {actionNodeAttributes.map(attr => (
                    <Option key={attr.value} value={attr.value} >
                        <Checkbox checked={selected.includes(attr.value)} />
                        {attr.label}
                    </Option>
                ))}
            </Select>
        </Tooltip>
    );
}


export const NodeSearchButton = () => {
    const rfi = useReactFlow();
    const { layout } = useLineageGraph();
    const [elementSearchText, setElementSearchText] = useState("");
    const [suggestions, setSuggestions] = useState<any>([]);

    const regexSearch = (node: ReactFlowNode, text: string) => {
        if (!node || !text) {
            return false;
        }

        const nodeIdLower = node.id.toLowerCase();
        let match = false;

        const prefixMatch = text.match(/^prefix:(.*)$/);
        const suffixMatch = text.match(/^suffix:(.*)$/);
        const includesMatch = text.match(/^includes:(.*)$/);

        if (prefixMatch) {
            const [, prefix] = prefixMatch;
            match = nodeIdLower.startsWith(prefix.toLowerCase());
        } else if (suffixMatch) {
            const [, suffix] = suffixMatch;
            match = nodeIdLower.endsWith(suffix.toLowerCase());
        } else if (includesMatch) {
            const [, includes] = includesMatch;
            match = nodeIdLower.includes(includes.toLowerCase());
        } else {
            // Default case: Match all nodes with the given string as a substring
            match = nodeIdLower.includes(text.toLowerCase());
        }

        return match;
    }

    useEffect(() => {
        if (elementSearchText) {
            const allNodes: ReactFlowNode[] = rfi.getNodes();
            const filteredSuggestions = allNodes
                .filter(node => regexSearch(node, elementSearchText))
                .map(node => ({
                    id: node.id,
                    type: isGroupBox(node) ? 'Groups' : 'Elements',
                }));
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    }, [elementSearchText]);


    const handleSuggestionClick = (_, suggestion) => {
        if (suggestion) {
            // a node inside a collapsed box is shown first
            revealGroupMember(rfi, suggestion.id, layout);
            const rfNode = rfi.getNode(suggestion.id)!;
            resetViewPortCentered(rfi, [rfNode]);
            setOpen(false);
        }
    };

    const [open, setOpen] = React.useState(false);
    const handleOpenChange = React.useCallback((event: React.SyntheticEvent | null, isOpen: boolean) => {
        setOpen(isOpen);
    }, []);

    return (
        <Dropdown open={open} onOpenChange={handleOpenChange} >
            <MenuButton endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1, outline: '0 !important' }}>
                <Tooltip arrow title={<>Search node. By default node name must contain search expr,<br/> but you can add 'prefix:' or 'suffix:' at the start to modify behaviour.</>} enterDelay={500} enterNextDelay={500} placement='top'>
                    <Search />
                </Tooltip>
            </MenuButton>
            <Menu placement="bottom-start" sx={{border: "none", padding: '0px', backgroundColor: 'transparent'}}>
                <Autocomplete
                    sx={{ width: 390 }}
                    freeSolo
                    placeholder="Search node"
                    options={suggestions}
                    filterOptions={(x) => x} // disable built-in filtering to override with our own search logic
                    getOptionLabel={(option) => option.id}
                    groupBy={(option) => option.type}
                    onChange={handleSuggestionClick}
                    onInputChange={(_, inputValue) => setElementSearchText(inputValue)}
                    autoFocus clearOnEscape={true} clearOnBlur={true}
                />
            </Menu>
        </Dropdown>
    );
};

export default function LineageGraphToolbar({props}: {props: flowProps}) {
    // grouping and the node attributes need the configuration behind the nodes, which the run view
    // does not have
    const isPropsConfigDefined = props.configData !== undefined;
    // a given graph is shown as a whole - by the run view and by the configuration tables - so
    // everything that selects a graph view or acts on a center node has nothing to act on there
    const showCenterNodeOptions = props.graph === undefined;
    // the lineage of a run is a tab of the run view, only the panel of the config explorer closes
    const showCloseButton = !props.runContext;
    // avoid DOM warning for Draggable, see https://github.com/react-grid-layout/react-draggable/blob/v4.4.2/lib/DraggableCore.js#L159-L171
    const nodeRef = useRef(null);
    const { graphView } = useLineageGraph();

    return (
        <Draggable bounds="parent" nodeRef={nodeRef}>
            <Box ref={nodeRef} sx={{ zIndex: componentZIndex, position: 'absolute', left: 0, top: 0, padding: 0.1, gap: 0.2, display: 'flex', flexDirection: 'row',                    
                border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'white',
            }}
            >
                <ToggleButtonGroup variant="plain" spacing={0.1}>
                    <NodeSearchButton/>
                </ToggleButtonGroup>
                {(showCenterNodeOptions || isPropsConfigDefined) && <>
                    <Divider orientation="vertical" />
                    <ToggleButtonGroup variant="plain" spacing={0.1}>
                        {showCenterNodeOptions && isPropsConfigDefined && <GraphExpansionButton />}
                        {showCenterNodeOptions && <GraphViewSelector props={props} />}
                        {isPropsConfigDefined && <GroupingButton />}
                        {isPropsConfigDefined && <NodeAttributeSelector />}
                    </ToggleButtonGroup>
                </>}
                <Divider orientation="vertical" />
                <ToggleButtonGroup variant="plain" spacing={0.1}>
                    <ShowAllButton />
                    {showCenterNodeOptions && <CenterFocusButton />}
                    <ResetLayoutButton />
                    <LayoutSelector forceAvailable={showCenterNodeOptions && graphView === 'relations'} />
                </ToggleButtonGroup>
                <Divider orientation="vertical" />
                <ToggleButtonGroup variant="plain" spacing={0.1}>
                    <DownloadLineageButton />
                    {showCloseButton && <CloseLineageButton />}
                </ToggleButtonGroup>
            </Box>
        </Draggable>
    );
}
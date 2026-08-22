import { Abc, AlignVerticalTop, Apps, ArrowDropDown, Clear, FitScreen, OpenInFull, Search, Send, FilterList } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import {CloudDownload, Close} from '@mui/icons-material';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SchemaIcon from '@mui/icons-material/Schema';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import ToggleButtonGroup from '@mui/joy/ToggleButtonGroup';
import * as React from 'react';
import { ReactElement } from 'react';

import { Autocomplete, Button, Divider, Dropdown, IconButton, Input, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip, Checkbox, Select, Option } from '@mui/joy';
// import Option from '@mui/joy/Option';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Node as ReactFlowNode, useReactFlow } from 'reactflow';
import { nodeAttributes, useLineageGraph, useLineagePanel } from '../../../hooks/useLineage';
import { dagreLayoutRf } from '../../../util/ConfigExplorer/Graphs';
import { computeNodePositionFromParent, computeParentNodePositionFromArray, flowProps, getGraphFromConfig, getNonParentNodesFromArray, getParentNodesFromArray, groupByFeed, groupBySubstring, prioritizeParentNodes, resetViewPort, resetViewPortCentered, restoreGroupSettings, restoreGroupSettingsBySubgroup } from '../../../util/ConfigExplorer/LineageTabUtils';
import { nodeHeight, nodeWidth } from './LineageTabWithSeparateView';

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

function GraphViewSelector() {
    const { graphView, setGraphView } = useLineageGraph();
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    const options = {
        full: {title: 'show full graph', icon: SchemaIcon},
        data: {title: 'show data graph', icon: TableViewTwoTone},
        action: {title: 'show action graph', icon: RocketLaunchOutlined},
    }

    const handleSelect = (value) => {
        setSelectedIndex(value === 'full' ? 0 : value === 'data' ? 1 : value === 'action' ? 2 : 0);
        setGraphView(value);
    };

    const createTooltip = (identifier, index, options) => {
        const title = options[identifier]['title']
        const Icon = options[identifier]['icon']

        return (
            <MenuItem selected={selectedIndex === index} onClick={() => { handleSelect(identifier); }}>
                <ListItemDecorator>
                    <Tooltip arrow title={title} enterDelay={500} enterNextDelay={500} placement='right'>
                        <Icon />
                    </Tooltip>
                </ListItemDecorator>
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
            <Menu sx={{ '--ListItemDecorator-size': '20px' }}>
                {createTooltip('full', 0, options)}
                {createTooltip('data', 1, options)}
                {createTooltip('action', 2, options)}
            </Menu>
        </Dropdown>
    )
}


function LayoutButton() {
    const { layout, setLayout } = useLineageGraph();

    /*
    return <div
        title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
        className="controls"
        style={styles}
    >*/
    return <Tooltip arrow title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'} enterDelay={500} enterNextDelay={500} placement='top'>
        <IconButton color={'neutral'} onClick={() => setLayout(layout === 'TB' ? 'LR' : 'TB')}>
            {layout === 'TB' ? <AlignVerticalTop /> : <AlignHorizontalLeft />}
        </IconButton>
    </Tooltip>
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

function recomputeLayout(rfi: any, layoutDirection: any) {
    const rfNodes = rfi.getNodes();
    const nonParentNodes = getNonParentNodesFromArray(rfNodes);
    const parentNodes = getParentNodesFromArray(rfNodes);
    const rfEdges = rfi.getEdges();

    var layoutedNonParentNodes = dagreLayoutRf(nonParentNodes, rfEdges, layoutDirection, nodeWidth, nodeHeight);
    var layoutedParentNodes = computeParentNodePositionFromArray(layoutedNonParentNodes, parentNodes);
    layoutedNonParentNodes = computeNodePositionFromParent(layoutedNonParentNodes, layoutedParentNodes);

    rfi.setNodes([...layoutedNonParentNodes, ...layoutedParentNodes])
    prioritizeParentNodes(rfi);
}

function RecomputeLayoutButton() {
    const rfi = useReactFlow();
    const { layout: layoutDirection } = useLineageGraph();

    // recomputes the layout from the current nodes in the flow instance (rfi)
    const handleOnClick = () => {
        recomputeLayout(rfi, layoutDirection);
    }

    return (
        <Tooltip arrow title='Recompute layout' enterDelay={500} enterNextDelay={500} placement='top'>
            <IconButton onClick={handleOnClick}>
                <Apps />
            </IconButton>
        </Tooltip>
    )
}

function GroupingButton({props: lineageTabProps}: {props: flowProps}) {
    const rfi = useReactFlow();
    const { graphView, layout, isExpanded } = useLineageGraph();
    const configData = lineageTabProps.configData;

    const [showByNameSelector, setShowByNameSelector] = useState(false);
    const [groupingOption, setGroupingOption] = useState<string>();
    const [groupingRoutine, setGroupingRoutine] = useState<'components' | 'subgroups'>();

    // TODO: consider interaction with other buttons
    const handleReset = () => {
        groupingRoutine === 'components' ? restoreGroupSettings(rfi)
                                         : restoreGroupSettingsBySubgroup(rfi, {graphView, props: lineageTabProps, layout, isExpanded});
        setGroupingOption(undefined);
        setGroupingRoutine(undefined);
        recomputeLayout(rfi, layout);
    }

    const handleApplyByName = (ev: React.FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        const name = ev.currentTarget.elements['name'].value;
        if (name && name.length>0) {
            setGroupingOption('byName');
            groupBySubstring(rfi, getGraphFromConfig(configData, graphView), {substring: name});
        }
        setOpen(false);
        setShowByNameSelector(false);
    }

    const handleApplyByFeed = () => {
        setGroupingOption('byFeed');
        groupByFeed(rfi, getGraphFromConfig(configData, graphView), layout);
    }

    const [open, setOpen] = React.useState(false);
    const handleOpenChange = React.useCallback((event: React.SyntheticEvent | null, isOpen: boolean) => {
        setOpen(isOpen);
        setShowByNameSelector(false);
    }, []);

    return (
        <Dropdown open={open} onOpenChange={handleOpenChange}>
            <MenuButton  endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1, outline: '0 !important' }}>
                <Tooltip arrow title='EXPERIMENTAL: Show grouping options' enterDelay={500} enterNextDelay={500} placement='top'>
                    <WorkspacesIcon />
                </Tooltip>
            </MenuButton>
            <Menu sx={{'--ListItemDecorator-size': '20px', overflow: 'visible' }}>
                {/* this is a normal button to avoid closing the dropdown */}
                <Button className='byName' onClick={() => setShowByNameSelector(true)} sx={{backgroundColor: (groupingOption=='byName' ? '#e6eef7' : 'white')}}>
                    <Tooltip arrow title='group by name' enterDelay={500} enterNextDelay={500} placement='right'>
                        <ListItemDecorator>
                            <Abc />
                        </ListItemDecorator>
                    </Tooltip>
                </Button>
                {/* this is an improvised "submenu" showing an input box for the name */}
                {showByNameSelector &&
                    <Box position="absolute" top={5} left={55} >
                        <form onSubmit={ev => handleApplyByName(ev)}>
                            <Input id="name" size="sm" sx={{width: 200}} autoFocus placeholder='Name substring...' endDecorator={<IconButton type="submit" size="sm"><Send/></IconButton>}/>
                        </form>
                    </Box>
                }
                <Tooltip arrow title='group by feed (only enabled if "action graph view" is selected)' enterDelay={500} enterNextDelay={500} placement='right'>
                    <span>{/* <span> is used to show tooltip also if MenuItem is disabled */}
                        <MenuItem className='byFeed' selected={groupingOption === 'byFeed'} onClick={handleApplyByFeed} disabled={graphView !== 'action'} sx={{ outline: '0 !important' }}>
                            <ListItemDecorator>
                                <SchemaIcon />
                            </ListItemDecorator>
                        </MenuItem>
                    </span>
                </Tooltip>
                <MenuItem onClick={handleReset} sx={{ outline: '0 !important' }}>
                    <ListItemDecorator>
                        <Tooltip arrow title='reset grouping' enterDelay={500} enterNextDelay={500} placement='right'>
                            <Clear />
                        </Tooltip>
                    </ListItemDecorator>
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
    const [elementSearchText, setElementSearchText] = useState("");
    const [suggestions, setSuggestions] = useState<any>([]);

    const regexSearch = (node: ReactFlowNode, text: string) => {
        if (!node || !text) {
            return false;
        }

        const nodeIdLower = node.id.toLowerCase();
        let match = false;

        const innerExpr = "((prefix|suffix|includes):)?((?!children).*)";
        const groupMatch = text.match(new RegExp(`^group:${innerExpr}$`));
        const childrenMatch = text.match(new RegExp(`^group:children:(.*)$`));
        const prefixMatch = text.match(/^prefix:(.*)$/);
        const suffixMatch = text.match(/^suffix:(.*)$/);
        const includesMatch = text.match(/^includes:(.*)$/);

        if (groupMatch) {
            const [, , groupType, groupName] = groupMatch;
            if (!groupType && !groupName) {
                // Matches all group nodes
                match = node.type === 'group';
            } else if (groupType === 'prefix') {
                match = node.type === 'group' && nodeIdLower.startsWith(groupName.toLowerCase());
            } else if (groupType === 'suffix') {
                match = node.type === 'group' && nodeIdLower.endsWith(groupName.toLowerCase());
            } else if (groupType === 'includes') {
                match = node.type === 'group' && nodeIdLower.includes(groupName.toLowerCase());
            }
        } else if (childrenMatch) {
            const [, groupName] = childrenMatch;
            match = node.parentId === groupName;
        } else if (prefixMatch) {
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
                    type: node.type === 'group' ? 'Parent Node' : 'Non-Parent Node',
                }));
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    }, [elementSearchText]);


    const handleSuggestionClick = (_, suggestion) => {
        if (suggestion) {
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
                        {showCenterNodeOptions && <GraphViewSelector />}
                        {isPropsConfigDefined && <GroupingButton props={props} />}
                        {isPropsConfigDefined && <NodeAttributeSelector />}
                    </ToggleButtonGroup>
                </>}
                <Divider orientation="vertical" />
                <ToggleButtonGroup variant="plain" spacing={0.1}>
                    <ShowAllButton />
                    {showCenterNodeOptions && <CenterFocusButton />}
                    <RecomputeLayoutButton />
                    <LayoutButton />
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
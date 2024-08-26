import { Abc, AlignVerticalTop, Apps, ArrowDropDown, Clear, FitScreen, OpenInFull } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SchemaIcon from '@mui/icons-material/Schema';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import ToggleButtonGroup from '@mui/joy/ToggleButtonGroup';
import * as React from 'react';

import { Autocomplete, Divider, Dropdown, IconButton, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip } from '@mui/joy';
// import Option from '@mui/joy/Option';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

import { Popper } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { ReactFlowInstance, Node as ReactFlowNode } from 'reactflow';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { dagreLayoutRf } from '../../../util/ConfigExplorer/Graphs';
import { computeNodePositionFromParent, computeParentNodePositionFromArray, getGraphFromConfig, getNonParentNodesFromArray, getParentNodesFromArray, groupByFeed, groupBySubstring, prioritizeParentNodes, resetViewPort, resetViewPortCentered, restoreGroupSettings, restoreGroupSettingsBySubgroup } from '../../../util/ConfigExplorer/LineageTabUtils';
import { getGroupedState, getGroupingRoutine, getRFI, setGroupingRoutine } from '../../../util/ConfigExplorer/slice/LineageTab/Common/ReactFlowSlice';
import { getConfigData } from '../../../util/ConfigExplorer/slice/LineageTab/Core/LineageTabCoreSlice';
import { getExpansionState, setExpansionState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice';
import { getGraphView, setGraphView } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import { setGroupingState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GroupingSlice';
import { getLayout, setLayout } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice';
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
    const dispatch = useAppDispatch();
    const graphView = useAppSelector(state => getGraphView(state));
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    const options = {
        full:
            <Tooltip arrow title='show full graph' enterDelay={500} enterNextDelay={500} placement='right'>
                <SchemaIcon />
            </Tooltip>,
        data:
            <Tooltip arrow title='show data graph' enterDelay={500} enterNextDelay={500} placement='right'>
                <TableViewTwoTone />
            </Tooltip>,
        action:
            <Tooltip arrow title='show action graph' enterDelay={500} enterNextDelay={500} placement='right'>
                <RocketLaunchOutlined />
            </Tooltip>
    }

    const handleSelect = (value) => {
        setSelectedIndex(value === 'full' ? 0 : value === 'data' ? 1 : value === 'action' ? 2 : 0);
        dispatch(setGraphView(value));
    };

    return (
        <Dropdown >
            <MenuButton endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1 }}>
                <Tooltip arrow title='Show graph view options' enterDelay={500} enterNextDelay={500} placement='right'>
                    {options[graphView]}
                </Tooltip>
            </MenuButton>
            <Menu sx={{ '--ListItemDecorator-size': '20px' }}>
                <MenuItem selected={selectedIndex === 0} onClick={() => { handleSelect('full'); }}>
                    <ListItemDecorator>{options['full']}</ListItemDecorator>
                </MenuItem>
                <MenuItem selected={selectedIndex === 1} onClick={() => { handleSelect('data'); }} >
                    <ListItemDecorator>{options['data']}</ListItemDecorator>
                </MenuItem>
                <MenuItem selected={selectedIndex === 2} onClick={() => { handleSelect('action'); }} >
                    <ListItemDecorator>{options['action']}</ListItemDecorator>
                </MenuItem>
            </Menu>
        </Dropdown>
    )
}


function LayoutButton() {
    const layout = useAppSelector((state) => getLayout(state));
    const dispatch = useAppDispatch();

    /*
    return <div
        title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
        className="controls"
        style={styles}
    >*/
    return <Tooltip arrow title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'} enterDelay={500} enterNextDelay={500} placement='right'>
        <IconButton color={'neutral'} onClick={() => dispatch(setLayout(layout === 'TB' ? 'LR' : 'TB'))}>
            {layout === 'TB' ? <AlignVerticalTop /> : <AlignHorizontalLeft />}
        </IconButton>
    </Tooltip>    
}

function GraphExpansionButton() {
    const dispatch = useAppDispatch();
    const isExpanded = useAppSelector((state) => getExpansionState(state));

    return <Tooltip arrow title={isExpanded ? 'Collapse graph' : 'Expand graph'} enterDelay={500} enterNextDelay={500} placement='right'>
        <IconButton
            color='neutral'
            onClick={() => dispatch(setExpansionState({ isExpanded: !isExpanded }))}
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
        <Tooltip arrow title='Download image as PNG file' enterDelay={500} enterNextDelay={500} placement='right'>
            <IconButton sx={{ display: "flex", flexDirection: "column" }}
                color='neutral'
                onClick={download}>
                <CloudDownloadIcon />
                {/* <Typography variant='plain' sx={{ fontSize: '0.55rem' }}>download</Typography> */}
            </IconButton>
        </Tooltip>
    );
}

function ShowAllButton() {
    const rfi: ReactFlowInstance = useAppSelector(state => getRFI(state));
    const handleOnClick = () => {
        resetViewPort(rfi);
    }

    return (
        <Tooltip arrow title='Show all' enterDelay={500} enterNextDelay={500} placement='right'>
            <IconButton onClick={handleOnClick}>
                <FitScreen />
            </IconButton>
        </Tooltip>
    )
}

function CenterFocusButton() {
    const rfi: ReactFlowInstance = useAppSelector(state => getRFI(state));
    const handleOnClick = () => {
        const nodes = rfi.getNodes();
        resetViewPortCentered(rfi, nodes);
    }
    return (
        <Tooltip arrow title='Focus on central node' enterDelay={500} enterNextDelay={500} placement='right'>
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
    const rfi = useAppSelector((state) => getRFI(state));
    const layoutDirection = useAppSelector((state) => getLayout(state));

    // recomputes the layout from the current nodes in the flow instance (rfi)
    const handleOnClick = () => {
        recomputeLayout(rfi, layoutDirection);
    }

    return (
        <Tooltip arrow title='Recompute layout' enterDelay={500} enterNextDelay={500} placement='right'>
            <IconButton onClick={handleOnClick}>
                <Apps />
            </IconButton>
        </Tooltip>
    )
}

function GroupingButton() {
    const dispatch = useAppDispatch();
    const rfi: ReactFlowInstance = useAppSelector(state => getRFI(state));
    const grouped = useAppSelector(state => getGroupedState(state));
    const graphView = useAppSelector(state => getGraphView(state));
    const configData = useAppSelector(state => getConfigData(state));
    const routine = useAppSelector(state => getGroupingRoutine(state));
    const layout = useAppSelector(state => getLayout(state));
    const expansionState = useAppSelector(state => getExpansionState(state));

    const [selectedIndex, setSelectedIndex] = useState('');
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [groupingOption, setGroupingOption] = useState('');
    const [popupPosition, setPopupPosition] = useState<{ top: number, left: number } | null>(null);

    const popupRef = useRef(null);
    const listItemRef = useRef(null);

    // select grouping function and apply based on the user input args
    const handleGroup = (option: string) => {
        var groupingFunc, args;
        // TODO: handle other cases if we use other grouping functions
        // TODO: handle switch between grouping routines
        switch (option) {
            case 'byName': {
                groupingFunc = groupBySubstring;
                args = { substring: inputValue }
                break;
            }
            case 'byFeed': { // TODO: enable this case only if in action graph view
                groupingFunc = groupByFeed;
                args = { feedName: inputValue }
                break;
            }
            // case '':
            // case '':
            default: { throw Error(`no option named ${option}`) }
        }

        groupingFunc(rfi, getGraphFromConfig(configData, graphView), args);
        dispatch(setGroupingState(true));
        setIsPopupVisible(false);
        // TODO: if we enable selection of grouping routine, on routine change,  propagate the selected here
        // dispatch(setGroupingRoutine(...))
    };

    // TODO: consider interaction with other buttons
    const handleReset = () => {
        routine === 'components' ? restoreGroupSettings(rfi) : restoreGroupSettingsBySubgroup(rfi);
        dispatch(setGroupingRoutine(undefined));
        dispatch(setGroupingState(false));
        setSelectedIndex('');
        setInputValue('');
        recomputeLayout(rfi, layout);
    }

    //TODO: handleApplyByName! How to avoid closing menu?!

    const handleApplyByFeed = () => {
        setGroupingOption('byFeed');
        setSelectedIndex(groupingOption);
        handleGroup(groupingOption);
    }

    return (
        <Dropdown>
            <MenuButton  endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1 }}>
                <Tooltip arrow title='EXPERIMENTAL: Show grouping options' enterDelay={500} enterNextDelay={500} placement='right'>
                    <WorkspacesIcon />
                </Tooltip>
            </MenuButton>
            <Menu sx={{'--ListItemDecorator-size': '20px' }} onClick={(ev) => ev.preventDefault()}>
                <MenuItem className='byName' selected={selectedIndex === 'byName'} onClick={(ev) => ev.preventDefault()}>
                    <Tooltip arrow title='group by name'  enterDelay={500} enterNextDelay={500} placement='right'>                            
                        <ListItemDecorator>
                            <Popper placement='right' open={selectedIndex === 'byName'}></Popper>
                            <Abc />
                        </ListItemDecorator>
                    </Tooltip>
                </MenuItem>
                <Tooltip arrow title='group by feed (only enabled if "action graph view" is selected)' enterDelay={500} enterNextDelay={500} placement='right'>                            
                    <span>{/* <span> is used to show tooltip also if MenuItem is disabled */}
                        <MenuItem className='byFeed' selected={selectedIndex === 'byFeed'}  onClick={handleApplyByFeed} disabled={graphView !== 'action'}> {/*onMouseEnter={(event) => { handlePopupEnter(event); }} >*/}                
                            <ListItemDecorator>
                                <SchemaIcon />
                            </ListItemDecorator>
                        </MenuItem>
                    </span>
                </Tooltip>
                <MenuItem onClick={handleReset}>
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


export const NodeSearchBar = () => {
    const rfi = useAppSelector((state) => getRFI(state));
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
            const rfNode = rfi.getNode(suggestion.id);
            resetViewPortCentered(rfi, [rfNode]);
        }
    };

    const width = 200;

    return (
        <Autocomplete
            sx={{
                width: width,
                position: 'absolute',
                right: 10,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '10px',
            }}
            freeSolo
            placeholder="Search object"
            options={suggestions}
            filterOptions={(x) => x} // disable built-in filtering to override with our own search logic
            getOptionLabel={(option) => option.id}
            groupBy={(option) => option.type}
            onChange={handleSuggestionClick}
            onInputChange={(_, inputValue) => setElementSearchText(inputValue)}
        />
    );
};

export default function LineageGraphToolbar() {
    const [alignment, setAlignment] = React.useState<string | null>('center');
    const [formats, setFormats] = React.useState(() => ['italic']);
    const isPropsConfigDefined = useAppSelector(state => getConfigData(state)) !== undefined;
    // avoid DOM warning for Draggable, see https://github.com/react-grid-layout/react-draggable/blob/v4.4.2/lib/DraggableCore.js#L159-L171
    const nodeRef = useRef(null);

    return (
        <Draggable bounds="parent" nodeRef={nodeRef}>
            <Box ref={nodeRef} sx={{ zIndex: componentZIndex, position: 'absolute', left: 0, top: 0, padding: 0.1, gap: 0.2, display: 'flex', flexDirection: 'row',                    
                    border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'white',
                }}
            >
                <ToggleButtonGroup variant="plain" spacing={0.1} value={formats} 
                    onChange={(event, newFormats) => {setFormats(newFormats);}}
                >
                    <ShowAllButton />
                    <CenterFocusButton />
                    <RecomputeLayoutButton />
                    <LayoutButton />
                </ToggleButtonGroup>
                <Divider orientation="vertical" />
                <ToggleButtonGroup variant="plain" spacing={0.1} value={formats}
                    onChange={(event, newFormats) => {setFormats(newFormats);}}                    
                >
                    {isPropsConfigDefined && <GraphExpansionButton />}
                    <GraphViewSelector />
                    <GroupingButton />
                </ToggleButtonGroup>
                <Divider orientation="vertical" />
                <ToggleButtonGroup variant="plain" spacing={0.1} value={formats}
                    onChange={(event, newFormats) => {setFormats(newFormats);}}
                >
                    <DownloadLineageButton />
                </ToggleButtonGroup>
                {/*<NodeSearchBar/>*/}
            </Box>
        </Draggable>
    );
}
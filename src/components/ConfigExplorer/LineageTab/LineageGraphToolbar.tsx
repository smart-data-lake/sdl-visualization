import * as React from 'react';
import ToggleButtonGroup from '@mui/joy/ToggleButtonGroup';
import { AlignVerticalTop, ArrowDropDown, ArrowRight, Expand, LoopOutlined } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import ReorderIcon from '@mui/icons-material/Reorder';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SchemaIcon from '@mui/icons-material/Schema';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckIcon from '@mui/icons-material/Check';

import { Button, ButtonGroup, Divider, Dropdown, IconButton, List, ListDivider, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, SvgIcon, Tooltip, Typography, Option, TextField, Input, Sheet, FormControl, FormLabel, Autocomplete, RadioGroup, Radio, FormHelperText } from '@mui/joy';
// import Option from '@mui/joy/Option';
import Select, { SelectOption } from '@mui/joy/Select';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

import Draggable from 'react-draggable';
import { getNonParentNodesFromArray, getParentNodeFromArray, getParentNodesFromArray, computeNodePositionFromParent, computeParentNodePositionFromArray, prioritizeParentNodes, computeChildNodeRelativePosition, getFreeNodesFromArray, GraphView, resetViewPort, resetViewPortCentered, getGraphFromConfig, groupBySubstring, groupByFeed, restoreGroupSettings } from '../../../util/ConfigExplorer/LineageTabUtils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { setGraphView, getGraphView } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux'
import { setLayout, getLayout } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice';
import { setExpansionState, getExpansionState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice';
import { getGroupedState, getRFI } from '../../../util/ConfigExplorer/slice/LineageTab/Common/ReactFlowSlice';
import { ReactFlowInstance } from 'reactflow';
import { dagreLayoutRf as computeLayoutFunc } from '../../../util/ConfigExplorer/Graphs';
import { setGroupingState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GroupingSlice';
import { getConfigData, getLineageTabProps } from '../../../util/ConfigExplorer/slice/LineageTab/Core/LineageTabCoreSlice';
import store from '../../../app/store';
import { Node as ReactFlowNode } from 'reactflow';
import CloseIcon from '@mui/icons-material/Close';

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
            <Menu sx={{ minWidth: 160, '--ListItemDecorator-size': '24px' }}>
                <MenuItem selected={selectedIndex === 0} onClick={() => { handleSelect('full'); }}>
                    <ListItemDecorator>
                        {options['full']}
                    </ListItemDecorator>
                    Show full graph
                </MenuItem>
                <MenuItem selected={selectedIndex === 1} onClick={() => { handleSelect('data'); }} >
                    <ListItemDecorator>
                        {options['data']}
                    </ListItemDecorator>
                    Show data graph
                </MenuItem>
                <MenuItem selected={selectedIndex === 2} onClick={() => { handleSelect('action'); }} >
                    <ListItemDecorator>
                        {options['action']}
                    </ListItemDecorator>
                    Show action graph
                </MenuItem>
            </Menu>
        </Dropdown>
    )
}


function LayoutButton() {
    const layout = useAppSelector((state) => getLayout(state));
    const dispatch = useAppDispatch();

    return <div
        title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
        className="controls"
        style={styles}
    >
        <IconButton
            color={'neutral'}
            onClick={() => dispatch(setLayout(layout === 'TB' ? 'LR' : 'TB'))}
        >
            {layout === 'TB' ? <AlignVerticalTop /> : <AlignHorizontalLeft />}
        </IconButton>
    </div>
}

function GraphExpansionButton() {
    const dispatch = useAppDispatch();
    const isExpanded = useAppSelector((state) => getExpansionState(state));
    const title = isExpanded ? 'Compress Graph' : 'Expand Graph';

    return <div
        title={title}
        style={styles}
    >
        <IconButton
            color='neutral'
            onClick={() => dispatch(setExpansionState({ isExpanded: !isExpanded }))}
        >
            {isExpanded ? <CloseFullscreenIcon /> : <OpenWithIcon />}
        </IconButton>
    </div>
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
        <div
            title='Download image as PNG file'
            style={styles}
        >
            <IconButton sx={{ display: "flex", flexDirection: "column" }}
                color='neutral'
                onClick={download}>
                <CloudDownloadIcon />
                {/* <Typography variant='plain' sx={{ fontSize: '0.55rem' }}>download</Typography> */}
            </IconButton>
        </div>
    );
}

function ResetViewPortButton() {
    const rfi: ReactFlowInstance = useAppSelector(state => getRFI(state));
    const handleOnClick = () => {
        resetViewPort(rfi);
    }

    return (
        <div
            title='Center viewport'
            style={styles}>
            <IconButton onClick={handleOnClick}>
                <LoopOutlined />
            </IconButton>
        </div>
    )
}

function CenterFocusButton() {
    const rfi: ReactFlowInstance = useAppSelector(state => getRFI(state));
    const handleOnClick = () => {
        const nodes = rfi.getNodes();
        resetViewPortCentered(rfi, nodes);
    }
    return (
        <div
            title='Focus on central node'
            style={styles}>
            <IconButton onClick={handleOnClick}>
                <FilterCenterFocusIcon />
            </IconButton>
        </div>
    )
}

function RecomputeLayoutButton() {
    const rfi = useAppSelector((state) => getRFI(state));
    const layoutDirection = useAppSelector((state) => getLayout(state));

    // recomputes the layout from the current nodes in the flow instance (rfi)
    const handleOnClick = () => {
        const rfNodes = rfi.getNodes();
        const nonParentNodes = getNonParentNodesFromArray(rfNodes);
        const parentNodes = getParentNodesFromArray(rfNodes);
        const rfEdges = rfi.getEdges();

        var layoutedNonParentNodes = computeLayoutFunc(nonParentNodes, rfEdges, layoutDirection);
        var layoutedParentNodes = computeParentNodePositionFromArray(layoutedNonParentNodes, parentNodes);
        layoutedNonParentNodes = computeNodePositionFromParent(layoutedNonParentNodes, layoutedParentNodes);

        rfi.setNodes([...layoutedNonParentNodes, ...layoutedParentNodes])
        prioritizeParentNodes(rfi);
    }

    // const handleOnClick1 = () => {
    //   // 1.layout parent nodes and "free" nodes jointly
    //   // 2.adjust children nodes relative to parents
    //   const rfNodes = rfi.getNodes();
    //   const nonParentNodes = getNonParentNodesFromArray(rfNodes);
    //   const freeNodes = getFreeNodesFromArray(rfNodes);
    //   const parentNodes = getParentNodesFromArray(rfNodes);
    //   const rfEdges = rfi.getEdges();
    // }

    return (
        <div
            title='Recompute layout'
            style={styles}>
            <IconButton onClick={handleOnClick}>
                <ReorderIcon />
            </IconButton>
        </div>
    )
}

function GroupingButton() {
    const dispatch = useAppDispatch();
    const rfi: ReactFlowInstance = useAppSelector(state => getRFI(state));
    const grouped = useAppSelector(state => getGroupedState(state));
    const graphView = useAppSelector(state => getGraphView(state));
    const configData = useAppSelector(state => getConfigData(state));
    const layout = useAppSelector(state => getLayout(state));
    const expansionState = useAppSelector(state => getExpansionState(state));

    const [selectedIndex, setSelectedIndex] = useState('');
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [groupingOption, setGroupingOption] = useState('');
    const [popupPosition, setPopupPosition] = useState<{ top: number, left: number } | null>(null);

    // select grouping function and apply based on the user input args
    const handleGroup = (option: string) => {
        var groupingFunc, args;
        // TODO: handle other cases if we use other grouping functions
        switch (option) {
            case 'byName': {
                groupingFunc = groupBySubstring;
                args = { substring: inputValue }
                break;
            }
            case 'byFeed': {
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
    };

    const handleReset = () => {
        setSelectedIndex('');
        setInputValue('');
        restoreGroupSettings(rfi);
        dispatch(setGroupingState(false));
    }

    const handlePopupEnter = (event: React.MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const option = event.currentTarget.classList[3]; // className stored here
        setPopupPosition({ top: y + 50, left: x + 100 });
        setGroupingOption(option);
        setIsPopupVisible(true);
    };

    const handlePopupLeave = () => {
        setIsPopupVisible(false);
    };

    const handleApply = () => {
        if (!inputValue.length) { return }
        if (grouped) { restoreGroupSettings(rfi) }
        setSelectedIndex(groupingOption);
        handleGroup(groupingOption);
        handlePopupLeave();
    }

    // there might be weird parent node overlappings, as the groupings are not guaranteed to be layed out well
    return (
        <Dropdown>
            <MenuButton endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1 }}>
                <Tooltip arrow title='Show grouping options' enterDelay={500} enterNextDelay={500} placement='right'>
                    <WorkspacesIcon />
                </Tooltip>
            </MenuButton>
            <Menu sx={{ minWidth: 200, '--ListItemDecorator-size': '24px' }}>
                <MenuItem className='byName' onMouseEnter={(event) => { handlePopupEnter(event); }}>
                    {/* {TODO: need popup here} */}
                    <ListItemDecorator>
                        {selectedIndex === 'byName' && <CheckIcon sx={{ position: 'absolute', bottom: 8, left: 5 }} />}
                    </ListItemDecorator>
                    Group by name
                </MenuItem>
                <MenuItem className='byFeed' onMouseEnter={(event) => { handlePopupEnter(event); }} >
                    <ListItemDecorator>
                        {selectedIndex === 'byFeed' && <CheckIcon sx={{ position: 'absolute', bottom: 8, left: 5 }} />}
                    </ListItemDecorator>
                    Group by feed
                </MenuItem>
                <ListDivider />
                <MenuItem onMouseOver={() => { }} >
                    <ListItemDecorator />
                    {/* <ListItemDecorator>
                        <ArrowRight sx={{position: 'absolute', bottom: 8, right: 25}}/>
                    </ListItemDecorator> */}
                    More...
                </MenuItem>
                <ListDivider />
                <MenuItem onMouseOver={() => { }}>
                    <ListItemDecorator />
                    {/* <ListItemDecorator>
                        <ArrowRight sx={{position: 'absolute', bottom: 8, right: 25}}/>
                    </ListItemDecorator> */}
                    Custom...
                </MenuItem>
                <ListDivider />
                <MenuItem onClick={handleReset}>
                    <ListItemDecorator />
                    Reset
                </MenuItem>
            </Menu>
            {isPopupVisible && popupPosition && (
                <Sheet sx={{ position: 'absolute', top: popupPosition.top, left: popupPosition.left, padding: 1.5, zIndex: 1, bgcolor: '#eff4f4' }}>
                    <Box display="flex" flexDirection="row" alignItems="center">
                        <FormControl >
                            <Box display="flex" flexDirection="row" alignItems="center">
                                <FormLabel>Grouping option: {groupingOption}</FormLabel>
                                <IconButton onClick={() => setIsPopupVisible(false)} sx={{ left: 110, bottom: 10 }}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>
                            <Input
                                value={inputValue}
                                required
                                placeholder="Enter grouping criterion ..."
                                type="email"
                                onChange={(e) => setInputValue(e.target.value)}
                                sx={{ marginBottom: 0 }}
                            />
                        </FormControl>
                        <Button variant="outlined" sx={{ bgcolor: '#ababab', borderColor: '#989898', borderWidth: 2, left: 5, bottom: -20 }}
                            onClick={handleApply}>Apply</Button>
                    </Box>
                    <Box>
                        <RadioGroup name="group by functions" sx={{ gap: 1, '& > div': { p: 1 } }} defaultValue={"subgroups"}>
                            <FormControl size="sm">
                                <FormLabel>select grouping routine</FormLabel>
                                <Radio  value="components" label="Connected components" />
                                {/* <FormHelperText>
                                    description
                                </FormHelperText> */}
                            </FormControl>
                            <FormControl size="sm">
                                <Radio value="subgroups" label="Subgroups" />
                            </FormControl>
                        </RadioGroup>
                    </Box>
                </Sheet>
            )}
        </Dropdown>
    )
}

function SettingsButton() {
    const handleOnClick = () => {

    }

    return (
        <div
            title='Settings'
            style={styles}>
            <IconButton onClick={handleOnClick}>
                <SettingsIcon />
            </IconButton>
        </div>
    )

}

function ShowDocumentationButton() {
    return (
        <Dropdown>
            <MenuButton endDecorator={<ArrowDropDown sx={{ position: 'absolute', bottom: 8, left: 25 }} />} sx={{ padding: 1 }}>
                <Tooltip arrow title='Show documentation options' enterDelay={500} enterNextDelay={500} placement='right'>
                    <DescriptionIcon />
                </Tooltip>
            </MenuButton>
            <Menu sx={{ minWidth: 160, '--ListItemDecorator-size': '24px' }}>
                <MenuItem
                    onClick={() => {
                        window.open('https://smartdatalake.ch/json-schema-viewer', '_blank');
                    }}
                >
                    Schema viewer
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        window.open('https://smartdatalake.ch/', '_blank');
                    }}
                >
                    Documentation
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

export default function LineageGraphToolbar({ rfi, configData }) {
    const [alignment, setAlignment] = React.useState<string | null>('center');
    const [formats, setFormats] = React.useState(() => ['italic']);
    const isPropsConfigDefined = useAppSelector(state => getConfigData(state)) !== undefined;
    // avoid DOM warning for Draggable, see https://github.com/react-grid-layout/react-draggable/blob/v4.4.2/lib/DraggableCore.js#L159-L171
    const nodeRef = useRef(null);

    return (
        <Draggable bounds="parent" nodeRef={nodeRef}>
            <Box ref={nodeRef}
                sx={{
                    zIndex: componentZIndex,
                    position: 'absolute',
                    left: 100,
                    top: 20,
                    padding: 0.7,
                    display: 'flex',
                    flexDirection: 'row',
                    border: '2.3px solid',
                    borderColor: 'divider',
                    borderRadius: '10px',
                    gap: 1,
                    // height: 55,
                    width: 500 + 200,
                    bgcolor: 'white',
                }}
            >

                <ToggleButtonGroup
                    variant="plain"
                    spacing={0.1}
                    value={alignment}
                    onChange={(event, newAlignment) => {
                        setAlignment(newAlignment);
                    }}
                    aria-label="text alignment"
                >
                    <SettingsButton />
                    <ShowDocumentationButton />
                </ToggleButtonGroup>
                <Divider orientation="vertical" />
                <ToggleButtonGroup
                    variant="plain"
                    spacing={0.1}
                    value={formats}
                    onChange={(event, newFormats) => {
                        setFormats(newFormats);
                    }}
                    aria-label="text formatting"
                >
                    <GroupingButton />
                    <GraphViewSelector />
                    {isPropsConfigDefined && <GraphExpansionButton />}
                </ToggleButtonGroup>
                <Divider orientation="vertical" />
                <ToggleButtonGroup
                    variant="plain"
                    spacing={0.1}
                    value={formats}
                    onChange={(event, newFormats) => {
                        setFormats(newFormats);
                    }}
                    aria-label="text formatting"
                >
                    <ResetViewPortButton />
                    <CenterFocusButton />
                    <RecomputeLayoutButton />
                    <LayoutButton />
                </ToggleButtonGroup>
                <Divider orientation="vertical" />
                <ToggleButtonGroup
                    variant="plain"
                    spacing={0.1}
                    value={formats}
                    onChange={(event, newFormats) => {
                        setFormats(newFormats);
                    }}
                    aria-label="text formatting"
                >
                    <DownloadLineageButton />
                </ToggleButtonGroup>
                <NodeSearchBar />
            </Box>
        </Draggable>
    );
}
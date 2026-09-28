// A grouping box: open, a background that drags its members along; collapsed, a node its members' edges end on.
import { CSSProperties, useEffect } from 'react';
import { Handle, NodeProps, Position, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { ExploreOutlined, LayersOutlined, UnfoldLess, UnfoldMore } from '@mui/icons-material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { IconButton, Tooltip, Typography } from '@mui/joy';
import Box from '@mui/joy/Box';

import { GROUP_ATTRIBUTE_LABELS, GROUP_HEADER, GroupAttribute, GroupAxis, GroupBoxData } from '../../../util/ConfigExplorer/Grouping';
import { setGroupBoxCollapsed } from '../../../util/ConfigExplorer/LineageTabUtils';
import { useLineageGraph } from '../../../hooks/useLineage';

// the icons the configuration tab marks these attributes with
export const GROUP_ATTRIBUTE_ICONS: Record<GroupAttribute, typeof LayersOutlined> = {
    feed: AltRouteIcon,
    subjectArea: ExploreOutlined,
    layer: LayersOutlined,
};

// lanes and columns in different colours, so that a grid of both reads as two groupings
const GROUP_COLORS: Record<GroupAxis, {border: string, background: string}> = {
    along: {border: 'rgba(9, 107, 222, 0.55)', background: 'rgba(9, 107, 222, 0.05)'},
    across: {border: 'rgba(214, 140, 0, 0.6)', background: 'rgba(252, 174, 30, 0.07)'},
};

// on the outer border, where the edge has to end - LineageTab.css moves every handle out by 15px
function handleOnBorder(position: Position): CSSProperties {
    const common = {background: 0, border: 0, minWidth: 0, minHeight: 0};
    switch (position) {
        case Position.Top:    return {...common, width: 24, height: 1, top: 0, left: '50%', transform: 'translate(-50%, -50%)'};
        case Position.Bottom: return {...common, width: 24, height: 1, bottom: 0, left: '50%', transform: 'translate(-50%, 50%)'};
        case Position.Left:   return {...common, width: 1, height: 24, left: 0, top: '50%', transform: 'translate(-50%, -50%)'};
        default:              return {...common, width: 1, height: 24, right: 0, top: '50%', transform: 'translate(50%, -50%)'};
    }
}

export const GroupBoxNode = ({id, data, sourcePosition, targetPosition}: NodeProps) => {
    const box: GroupBoxData = data.box;
    const rfi = useReactFlow();
    const { layout } = useLineageGraph();
    const updateNodeInternals = useUpdateNodeInternals();
    // the handles only exist while collapsed
    useEffect(() => { updateNodeInternals(id); }, [box.collapsed]);

    const Icon = GROUP_ATTRIBUTE_ICONS[box.attribute];
    const colors = GROUP_COLORS[box.axis];
    const title = `${GROUP_ATTRIBUTE_LABELS[box.attribute]}: ${box.key}`;
    const toggle = () => setGroupBoxCollapsed(rfi, id, !box.collapsed, layout);

    // the button sits in the right corner, clear of the edges running through the middle of a box, which are drawn above it
    const header = (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, width: '100%'}}>
            <Tooltip title={GROUP_ATTRIBUTE_LABELS[box.attribute]} size="sm" enterDelay={500}>
                {/* pulled in by the padding inside the glyph, so that it lines up with the text under it */}
                <Icon sx={{fontSize: 20, color: colors.border, ml: '-2.5px'}}/>
            </Tooltip>
            {/* the size of a node's title */}
            <Typography noWrap data-testid="group-box-title" sx={{fontSize: 16, fontWeight: 'bold'}}>{box.key}</Typography>
            <Tooltip title={box.collapsed ? 'Expand group' : 'Collapse group'} size="sm" enterDelay={500}>
                <IconButton className="nodrag" size="sm" variant="plain" onClick={toggle} aria-label={box.collapsed ? 'Expand group' : 'Collapse group'}
                            sx={{'--IconButton-size': '24px', ml: 'auto', flexShrink: 0}}>
                    {box.collapsed ? <UnfoldMore/> : <UnfoldLess/>}
                </IconButton>
            </Tooltip>
        </Box>
    );

    if (!box.collapsed) {
        return (
            <Box sx={{width: '100%', height: '100%', boxSizing: 'border-box', cursor: 'grab',
                      border: `2px dashed ${colors.border}`, borderRadius: '12px', bgcolor: colors.background}}>
                <Box sx={{height: `${GROUP_HEADER}px`, px: 1, display: 'flex', alignItems: 'center'}}>
                    {header}
                </Box>
            </Box>
        );
    }

    return (
        <Tooltip title={<Box sx={{whiteSpace: 'pre-line'}}>{`${title}\n${box.memberIds.join('\n')}`}</Box>}
                 size="sm" enterDelay={500} placement="top" disableInteractive>
            <Box sx={{width: '100%', height: '100%', boxSizing: 'border-box', px: 1.5, py: 0.5,
                      border: `3px solid ${colors.border}`, borderRadius: '10px', bgcolor: 'white',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <Handle type="target" position={targetPosition ?? Position.Top} id={id} style={handleOnBorder(targetPosition ?? Position.Top)}/>
                {header}
                <Typography level="body-xs" data-testid="group-box-count">
                    {box.memberIds.length} {box.memberIds.length === 1 ? 'element' : 'elements'}
                </Typography>
                <Handle type="source" position={sourcePosition ?? Position.Bottom} id={id} style={handleOnBorder(sourcePosition ?? Position.Bottom)}/>
            </Box>
        </Tooltip>
    );
};

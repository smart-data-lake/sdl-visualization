import { BlockOutlined, DoNotDisturbAltOutlined, PendingOutlined, RunCircleOutlined, PieChart } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Tooltip, Box } from '@mui/joy';
import React from 'react';
import { getStatusColor } from '../../components/WorkflowsExplorer/Timeline/TimelineRow/utils';

export const getIcon = (status: string, marginLeft: string = '0.5rem', additionalStyle: object = {} ) => {
    const color = getStatusColor(status);
    const statusIconMap = {
        'PENDING': PendingOutlined,
        'PREPARING': PendingOutlined,
        'PREPARED': PendingOutlined,
        'INITIALIZING': PendingOutlined,
        'INITIALIZED': PendingOutlined,
        'RUNNING': RunCircleOutlined,
        'SUCCEEDED': CheckCircleOutlineIcon,
        'FAILED': HighlightOffIcon,
        'SKIPPED': DoNotDisturbAltOutlined,
        'CANCELLED': BlockOutlined
    };
    const iconName = (status ? statusIconMap[status.toUpperCase()] : HelpOutlineIcon) || HelpOutlineIcon;
    const iconComponent = React.createElement(iconName, {sx: { color: color, scale: '80%', ml: marginLeft, zIndex: 0, ...additionalStyle }});
    return (
        <Tooltip arrow title={status} enterDelay={500} enterNextDelay={500}>
            {iconComponent}
        </Tooltip>
    )
}

export const getPartitionStatus = (isPartioned: Boolean = false) => {
    if (isPartioned) {
        return (
            <Tooltip arrow title={"Data Object is partitioned."} enterDelay={500} enterNextDelay={500}>
                {React.createElement(PieChart, { className: 'data-node-partition-state-icon node-attributes' })}
            </Tooltip>
        );
    } else {
        return null;
    }
}

export const getExecutionMode = (executionMode) => {
    const executionModeMapper = (e) => {
        if (e === undefined) {
            return "D"; // When it is not defined it uses the default Processing mode
        } else if (e.includes("Partition")) {
            return "P";
        } else if (e.includes("Incremental") || e.includes("Streaming")) {
            return "I";
        } else if (e == "CustomMode") {
            return "C";
        } else if (e == "ProcessAllMode") {
            return "A";
        } else {
            return "X"; // Catch other cases
        }
    };

    let tooltipTitle;
    if (executionMode === undefined) {
        tooltipTitle = "Default Mode";
    } else if (executionMode != null) {
        tooltipTitle = executionMode;
    } else {
        tooltipTitle = "No execution mode specified.";
    }

    return (
        <Tooltip arrow title={tooltipTitle} enterDelay={500} enterNextDelay={500}>
            <Box className="circle-letter-parent">
                <Box component="span" className={`circle-letter node-attributes`}>
                    {executionModeMapper(executionMode)}
                </Box>
            </Box>
        </Tooltip>
    );
}

export class Filter {
    group: string;
    name: string;
    predicate: (any) => boolean;

    constructor(group: string, name: string, predicate: (any) => boolean) {
        this.group = group;
        this.name = name;
        this.predicate = predicate;
    }

    fun(rows: any[]) {
        return rows.filter(this.predicate);
    }
}

export function stateFilters(column: string) {
    return [
        new Filter('state', 'Pending', row => row[column] === 'PENDING'),
        new Filter('state', 'Preparing', row => row[column] === 'PREPARING'),
        new Filter('state', 'Prepared', row => row[column] === 'PREPARED'),
        new Filter('state', 'Initializing', row => row[column] === 'INITIALIZING'),
        new Filter('state', 'Initialized', row => row[column] === 'INITIALIZED'),
        new Filter('state', 'Running', row => row[column] === 'RUNNING'),
        new Filter('state', 'Succeeded', row => row[column] === 'SUCCEEDED'),
        new Filter('state', 'Failed', row => row[column] === 'FAILED'),
        new Filter('state', 'Skipped', row => row[column] === 'SKIPPED'),
        new Filter('state', 'Cancelled', row => row[column] === 'CANCELLED'),
    ]
};

export const phaseFilters = [
    new Filter('phase', 'Prepare', row => row === 'Prepared'),
    new Filter('phase', 'Init', row => row === 'Init'),
    new Filter('phase', 'Exec', row => row === 'Exec'),
];

export const checkFiltersAvailability = (rows: any, filters: Filter[]) => {
    return filters.filter(filter => filter.fun(rows).length > 0);
}

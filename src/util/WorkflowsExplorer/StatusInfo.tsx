import { BlockOutlined, DoNotDisturbAltOutlined, PendingOutlined, RunCircleOutlined } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Tooltip } from '@mui/joy';
import React from 'react';
import { getStatusColor } from '../../components/WorkflowsExplorer/Timeline/TimelineRow/utils';

export const getIcon = (status: string, marginLeft: string = '0.5rem') => {
    const color = getStatusColor(status);
    const statusIconMap = {
        'SUCCEEDED': CheckCircleOutlineIcon,
        'RUNNING': RunCircleOutlined,
        'FAILED': HighlightOffIcon,
        'INITIALIZED': PendingOutlined,
        'PREPARED': PendingOutlined,
        'SKIPPED': DoNotDisturbAltOutlined,
        'CANCELLED': BlockOutlined
    };
    const iconName = statusIconMap[status.toUpperCase()] || HelpOutlineIcon;
    const iconComponent = React.createElement(iconName, {sx: { color: color, scale: '80%', ml: marginLeft, zIndex: 0 }});
    return (
        <Tooltip arrow title={status} enterDelay={500} enterNextDelay={500}>
            {iconComponent}
        </Tooltip>
    )
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
        new Filter('state', 'Succeeded', row => row[column] === 'SUCCEEDED'),
        new Filter('state', 'Running', row => row[column] === 'RUNNING'),
        new Filter('state', 'Cancelled', row => row[column] === 'CANCELLED'),
        new Filter('state', 'Failed', row => row[column] === 'FAILED'),
        new Filter('state', 'Prepared', row => row[column] === 'PREPARED'),
        new Filter('state', 'Initialized', row => row[column] === 'INITIALIZED'),
        new Filter('state', 'Skipped', row => row[column] === 'SKIPPED'),
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

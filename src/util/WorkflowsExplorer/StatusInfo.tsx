import { BlockOutlined, DoNotDisturbAltOutlined, PendingOutlined } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Tooltip } from '@mui/joy';
import React from 'react';

export const getStatusColor = (name: string) => {

    switch (name.toUpperCase()) {
        case 'SUCCEEDED':
            return 'success';
        case 'FAILED':
            return 'danger'; // danger?
        case 'RUNNING':
            return 'warning';
        case 'INITIALIZED':
            return 'primary';
        case 'PREPARED':
            return 'neutral';
        case 'SKIPPED':
            return 'neutral';
        case 'CANCELLED':
            return 'warning'
        default:
            return 'neutral' // neural?
    }
}

export const getIcon = (status: string, marginLeft: string = '0.5rem') => {
    const color = getStatusColor(status);
    const statusIconMap = {
        'SUCCEEDED': CheckCircleOutlineIcon,
        'FAILED': HighlightOffIcon,
        'INITIALIZED': PendingOutlined,
        'PREPARED': PendingOutlined,
        'SKIPPED': DoNotDisturbAltOutlined,
        'CANCELLED': BlockOutlined
    };
    const iconName = statusIconMap[status] || HelpOutlineIcon;
    const iconComponent = React.createElement(iconName, {color: color, sx: { scale: '80%', ml: marginLeft, zIndex: 0 }});
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
    new Filter('phase', 'Prepared', row => row['phase'] === 'Prepared'),
    new Filter('phase', 'Initialized', row => row['phase'] === 'Initialized'),
    new Filter('phase', 'Execution', row => row['phase'] === 'Execution'),
];

export const checkFiltersAvailability = (rows: any, filters: Filter[]) => {
    return filters.filter(filter => filter.fun(rows).length > 0);
}

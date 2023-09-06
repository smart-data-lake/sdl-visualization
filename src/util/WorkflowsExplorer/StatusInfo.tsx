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
    name: string;
    predicate: (any) => boolean;

    constructor(name: string, predicate: (any) => boolean) {
        this.name = name;
        this.predicate = predicate;
    }

    fun(rows: any[]) {
        return rows.filter(this.predicate);
    }
}

export const defaultFilters = (columnName?: string) => {    
    const column = columnName ? columnName : 'status';
    return [
        new Filter('Succeeded', row => row[column] === 'SUCCEEDED'),
        new Filter('Running', row => row[column] === 'RUNNING'),
        new Filter('Cancelled', row => row[column] === 'CANCELLED'),
        new Filter('Failed', row => row[column] === 'FAILED'),
        new Filter('Prepared', row => row[column] === 'PREPARED'),
        new Filter('Initialized', row => row[column] === 'INITIALIZED'),
        new Filter('Skipped', row => row[column] === 'SKIPPED'),
    ]
};

export const checkFiltersAvailability = (rows: any, filters: Filter[]) => {
    return filters.filter(filter => filter.fun(rows).length > 0);
}

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export const getButtonColor = (name: string) => {
    switch (name.toUpperCase()) {
        case 'SUCCEEDED':
            return 'success';
        case 'FAILED':
            return 'danger';
        case 'RUNNING':
            return 'warning';
        case 'INITIALIZED':
            return 'primary';
        case 'PREPARED':
            return 'info';
        default:
            return 'neutral'
    }
}

export const getIcon = (status: string) => {
    const tmp = getButtonColor(status);
    const color = tmp === 'neutral' ? 'disabled' : (tmp === 'danger' ? 'error' : tmp);

    switch (status) {
        case 'SUCCEEDED':
            return <CheckCircleOutlineIcon color={color} sx={{ scale: '80%', ml: '0.5rem' }} />
        case 'FAILED':
            return <HighlightOffIcon color={color} sx={{ scale: '80%', ml: '0.5rem' }} />
        case 'INITIALIZED':
            return <ErrorOutlineIcon color={color} sx={{ scale: '80%', ml: '0.5rem' }} /> 
        case 'PREPARED':
            return <ErrorOutlineIcon color={color} sx={{ scale: '80%', ml: '0.5rem' }} />
        default:
            return <HelpOutlineIcon color={color} sx={{ scale: '80%', ml: '0.5rem' }} />
    }
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

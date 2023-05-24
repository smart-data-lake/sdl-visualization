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
    const tmp = getButtonColor(getSDLBStatus(status));
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

export const defaultFilters = (columnName?: string) => {    
    const column = columnName ? columnName : 'status';
    return [
        {name: 'Succeeded', fun: (rows: any) => {return rows.filter(row => row[column] === 'SUCCEEDED')}},
        {name: 'Running', fun: (rows: any) => {return rows.filter(row => row[column] === 'RUNNING')}},
        {name: 'Cancelled', fun: (rows: any) => {return rows.filter(row => row[column] === 'CANCELLED')}},
        {name: 'Failed', fun: (rows: any) => {return rows.filter(row => row[column] === 'FAILED')}},
        {name: 'Prepared', fun: (rows: any) => {return rows.filter(row => row[column] === 'PREPARED')}},
        {name: 'Initialized', fun: (rows: any) => {return rows.filter(row => row[column] === 'INITIALIZED')}},
        {name: 'Skipped', fun: (rows: any) => {return rows.filter(row => row[column] === 'SKIPPED')}},
    ]
};

export const checkFiltersAvailability = (rows: any, filters: any[]) => {
    let availableFilters : any = [];
    filters.forEach(filter => {
        if (filter.fun(rows).length > 0) {
            availableFilters.push(filter);
        }
    });
    return availableFilters;
}

export const getSDLBStatus = (status: string) => {
    if (status === 'SUCCEEDED') {
        return 'SUCCEEDED';
    } else if (status === 'SKIPPED') {
        return 'SKIPPED';
    } 
    return status;
}
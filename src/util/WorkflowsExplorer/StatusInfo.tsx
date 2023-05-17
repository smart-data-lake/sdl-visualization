
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export const getButtonColor = (name: string) => {
    switch (name) {
        case 'Succeeded':
            return 'success';
        case 'Failed':
            return 'danger';
        case 'Running':
            return 'warning';
        case 'Initialized':
            return 'primary';
        case 'PREPARED':
            return 'info';
        /* case 'Cancelled':
            return 'warning'; */
        default:
            return 'neutral';
    }
}

export const getIcon = (name: string) => {
    switch (name) {
        case 'SUCCEEDED':
            return <CheckCircleOutlineIcon color='success' sx={{ scale: '80%', ml: '0.5rem' }} />
        case 'FAILED':
            return <HighlightOffIcon color='error' sx={{ scale: '80%', ml: '0.5rem' }} />
        /* case 'CANCELLED':
            return <ErrorOutlineIcon color='warning' sx={{ scale: '80%', ml: '0.5rem' }} /> */
        case 'INITIALIZED':
            return <ErrorOutlineIcon color='primary' sx={{ scale: '80%', ml: '0.5rem' }} /> 
        case 'PREPARED':
            return <ErrorOutlineIcon color='info' sx={{ scale: '80%', ml: '0.5rem' }} />
        default:
            return <HelpOutlineIcon color='disabled' sx={{ scale: '80%', ml: '0.5rem' }} />
    }
}

export const defaultFilters = [
    {name: 'Succeeded', fun: (rows: any) => {return rows.filter(row => row.status === 'SUCCEEDED')}},
    {name: 'Running', fun: (rows: any) => {return rows.filter(row => row.status === 'RUNNING')}},
    {name: 'Cancelled', fun: (rows: any) => {return rows.filter(row => row.status === 'CANCELLED')}},
    {name: 'Failed', fun: (rows: any) => {return rows.filter(row => row.status === 'FAILED')}},
    {name: 'Prepared', fun: (rows: any) => {return rows.filter(row => row.status === 'Prepared')}},
    {name: 'Initialized', fun: (rows: any) => {return rows.filter(row => row.status === 'Initialized')}},
];
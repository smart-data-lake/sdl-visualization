import CloseIcon from '@mui/icons-material/Close';
import { Button, IconButton, Sheet, Table, Tooltip, Typography } from "@mui/joy";
import { useNavigate, useParams } from "react-router-dom";
import { useConfig } from "../../../hooks/useConfig";
import { useManifest } from "../../../hooks/useManifest";
import { Row } from "../../../types";
import Attempt from "../../../util/WorkflowsExplorer/Attempt";
import { formatFileSize } from '../../../util/helpers';
import { createPropertiesComponent } from '../../ConfigExplorer/PropertiesComponent';

const getRow = (attempt: Attempt, taskName: string) => {
    if (taskName === 'err') throw(new Error('was not able to fetch task name'));

    return attempt.timelineRows.filter((row) => {return row.step_name === taskName})[0];
}

/**
 * The content sheet component displays the metadata of a task. It is used in the ContentDrawer component. 
 * It displays the main metrics of a task if they are available, otherwise it displays the subfeed.
 * If available, it also displays the message of the task.
 * @param props action: Row - the row to display
 * @returns 
*/
const ContentSheet = (props: {action: Row}) => {
    const { action } = props;
    
    return (
        <Sheet sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: '1rem' }}>
            {action.message && 
                <Sheet color="neutral" variant="soft" key='resultSheet' invertedColors
                    sx={{ p: '1rem', mt: '1rem', borderRadius: '0.5rem',}}>
                    <Typography color="neutral" level='body-md'>
                        Info:
                    </Typography>
                    <code>
                        {action.message}
                    </code>
                </Sheet>
            }            
            {action.details.results.map((result) => {
                const subFeedProps: any = result.mainMetrics;
                if (result.partitionValues && result.partitionValues.length > 0) subFeedProps!.partitionValues = result.partitionValues;
                return createPropertiesComponent({obj: subFeedProps, orderProposal: [], propsToIgnore: ['stage'], title: 'Output '+result.dataObjectId})
            })}
        </Sheet>
    )
}

/**
 * ContentDrawer is a component that displays the content of a task. It can be opened by clicking on a task in the Run component and closed by clicking the close button.
 * The content is fetched from the attempt object. It is displayed in a ContentSheet.
 * @param props attempt: Attempt
 * @returns 
 */
const ContentDrawer = (props: {attempt: Attempt}) => {
    const { attempt } = props;
    const { flowId, runNumber, taskId, tab, stepName } = useParams();
    const {data: manifest} = useManifest();
    const {data: configData} = useConfig(manifest);
    const navigate = useNavigate();
    const navigateRel = (subPath: string) => navigate(subPath, {relative: 'path'}); // this navigates Relative to path, not route

    const action : Row = getRow(attempt, stepName || 'err');
    
    const isActionInConfig = () => (configData && configData.actions[action.step_name])

    const handleClick = () => {
        navigate(`/config/actions/${action.step_name}`);
    }

    return ( 
        <Sheet sx={{ gap: '1rem', height: '100%' }}>
            <Sheet sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Sheet sx={{display: 'flex', flexDirection: 'row', position: 'sticky'}}>
                    <Tooltip title={action.step_name}>
                        <Typography sx={{ flex: 1, cursor: 'default'}} noWrap level='h4'>
                            {action.step_name}
                        </Typography>
                    </Tooltip>
                    <IconButton variant="plain" color="neutral" size="sm" onClick={() => navigateRel("..")}>
                        <CloseIcon />
                    </IconButton>
                </Sheet>
                <Sheet sx={{ flex: 1, overflowY: 'auto', width: '100%' }}>
                        <ContentSheet action={action}/>
                </Sheet>
                <Button disabled={!isActionInConfig()} onClick={() => handleClick() } sx={{ width: "fit-content" }} size="sm" variant="solid">Open in Config Viewer</Button>
            </Sheet>
        </Sheet>
     );
}
 
export default ContentDrawer;
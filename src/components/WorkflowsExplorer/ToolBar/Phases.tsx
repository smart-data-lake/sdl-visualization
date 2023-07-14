import { Button, Checkbox, Menu, Sheet, Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import { getButtonColor } from "../../../util/WorkflowsExplorer/StatusInfo";

const Phases = (props: {updatePhases: (phases: {name: string, checked: boolean}[]) => void}) => {
    const { updatePhases } = props;
    const [phases, setPhases] = useState([{name: 'Execution', checked: true}, {name: 'Prepared', checked: false}, {name: 'Initialized', checked: false}]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const open = Boolean(anchorEl);
    
    const countFalse = () => {
        let count = 0;
        phases.forEach(phase => {
            if (!phase.checked) {
                count++;
            }
        });

        return count;    
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    useEffect(() => {
        updatePhases(phases);
    }, [phases])

    return ( 
        <Button size="sm" variant="outlined" onClick={handleClick} sx={{gap: '1rem'}}>
            Phases
            <Menu
                id="selected-demo-menu"
                anchorEl={anchorEl}
                open={open}
                aria-labelledby="selected-demo-button"
            >
                {phases.map((phase, index) => (
                    <Sheet
                        color={getButtonColor(phase.name)}
                        variant="plain"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            py: '0.25rem',
                            px: '0.5rem',
                            borderRadius: '0.5rem',
                        }}
                    >
                        <Checkbox
                            disabled={countFalse() === phases.length - 1 && phase.checked}
                            color={getButtonColor(phase.name.toUpperCase())}
                            size="sm"
                            variant="outlined"
                            checked={phase.checked}
                            onChange={() => {
                                const newPhases = [...phases];
                                newPhases[index].checked = !phases[index].checked;
                                setPhases(newPhases);
                            }}
                        />
                        <Typography level="body2">{phase.name}</Typography>
                    </Sheet>
                ))}
            </Menu>
        </Button>
     );
}
 
export default Phases;
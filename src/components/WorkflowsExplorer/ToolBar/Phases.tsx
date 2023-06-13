import { Button, Checkbox, Sheet, Switch, Typography } from "@mui/joy";
import { useEffect, useState } from "react";

const Phases = (props: {updatePhases: (checked: boolean) => void}) => {
    const { updatePhases } = props;
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        updatePhases(checked);
    }, [checked])

    return ( 
        <Button size="sm" variant="outlined" onClick={() => setChecked(!checked)} sx={{gap: '1rem'}}>
            Show phases:
            <Checkbox size="sm" variant="outlined" checked={checked}/>
        </Button>
     );
}
 
export default Phases;
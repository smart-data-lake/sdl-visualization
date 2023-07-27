import { Sheet } from "@mui/joy";
import { TabContext, TabPanel } from "@mui/lab";
import { Tab, Tabs } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { ConfigDataLists } from "../../util/ConfigExplorer/ConfigData";
import DataTable from "./DataTable";

export default function ElementTable(props: {dataLists: ConfigDataLists}) {
    
    const {dataLists} = props;
    const {elementType} = useParams();
    const navigate = useNavigate();    

    const handleChange = (_: React.SyntheticEvent, newValue: string) => {
        navigate(`/config/${newValue}`);
    };    

    return (
		<Sheet sx={{ flex: 1, minWidth: '500px', display: 'flex', flexDirection: 'column',  p: '1rem'}}>

			<TabContext value={elementType || "dataObjects"}>
				<Sheet sx={{ display: 'flex', justifyContent: 'space-between'}}>
					<Tabs value={elementType} onChange={handleChange} aria-label="element tabs">
						<Tab label="Data Objects" value="dataObjects" />
						<Tab label="Actions" value="actions" />
						<Tab label="Connections" value="connections" />
					</Tabs>
				</Sheet>
				<TabPanel value="dataObjects" className="content-panel" sx={{height: '100%', width: '100%', overflowY: 'auto'}}>
                    <DataTable data={dataLists.dataObjects} columns={["id", "type", "path", "table", "connectionId"]} navigatePrefix={`/config/dataObjects/`} navigateAttr="id"/>
				</TabPanel>
				<TabPanel value="actions" className="content-panel"  sx={{height: '100%', width: '100%', overflowY: 'auto'}}>
                    <DataTable data={dataLists.actions} columns={["id", "type", "inputIds", "outputIds"]} navigatePrefix={`/config/actions/`} navigateAttr="id"/>
				</TabPanel>
				<TabPanel value="connections" className="content-panel"  sx={{height: '100%', width: '100%', overflowY: 'auto'}}>
                    <DataTable data={dataLists.connections} columns={["id", "type"]} navigatePrefix={`/config/connections/`} navigateAttr="id"/>
				</TabPanel>
            </TabContext> 
		</Sheet>        
    )
  }
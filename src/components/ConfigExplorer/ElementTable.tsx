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
		<Sheet sx={{ flex: '1', minWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column', p: '0.5rem 1rem 0.1rem 1rem'}}>

			<TabContext value={elementType || "dataObjects"}>
				<Sheet sx={{ display: 'flex', justifyContent: 'space-between', height: '48px'}}>
					<Tabs value={elementType} onChange={handleChange} aria-label="element tabs">
						<Tab label="Data Objects" value="dataObjects" disabled={dataLists.dataObjects.length===0} />
						<Tab label="Actions" value="actions" disabled={dataLists.actions.length===0} />
						<Tab label="Connections" value="connections" disabled={dataLists.connections.length===0} />
					</Tabs>
				</Sheet>
				<TabPanel value="dataObjects" className="content-panel" sx={{flex: 1, minHeight: 0, width: '100%', paddingTop: '10px'}}>
                    <DataTable data={dataLists.dataObjects} columns={["id", "type", "path", "table.db", "table.name", "connectionId"]} navigator={(row) => `/config/dataObjects/${row.id}`} keyAttr="id"/>
				</TabPanel>
				<TabPanel value="actions" className="content-panel" sx={{flex: 1, minHeight: 0, width: '100%', paddingTop: '10px'}}>
                    <DataTable data={dataLists.actions} columns={["id", "type", "inputIds", "outputIds"]} navigator={(row) => `/config/actions/${row.id}`} keyAttr="id"/>
				</TabPanel>
				<TabPanel value="connections" className="content-panel" sx={{flex: 1, minHeight: 0, width: '100%', paddingTop: '10px'}}>
                    <DataTable data={dataLists.connections} columns={["id", "type"]} navigator={(row) => `/config/connections/${row.id}`} keyAttr="id"/>
				</TabPanel>
            </TabContext> 
		</Sheet>        
    )
  }

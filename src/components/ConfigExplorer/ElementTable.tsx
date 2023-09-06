import { Sheet, Tab, TabList, TabPanel, Tabs } from "@mui/joy";
import { useNavigate, useParams } from "react-router-dom";
import { ConfigDataLists } from "../../util/ConfigExplorer/ConfigData";
import DataTable from "./DataTable";

export default function ElementTable(props: {dataLists: ConfigDataLists}) {
    
    const {dataLists} = props;
    const {elementType} = useParams();
    const navigate = useNavigate();    

    return (
		<Sheet sx={{ flex: '1', minWidth: '500px', height: '100%', display: 'flex', flexDirection: 'column', p: '1rem 0rem 0.1rem 0.5rem'}}>
			<Tabs size="md" value={elementType || "dataObjects"} onChange={(e,v) => navigate(`/config/${v}`)} aria-label="element tabs">
				<Sheet sx={{ display: 'flex', justifyContent: 'space-between'}}>
					<TabList size="md">
						<Tab value="dataObjects" disabled={dataLists.dataObjects.length===0}>Data Objects</Tab>
						<Tab value="actions" disabled={dataLists.actions.length===0}>Actions</Tab>
						<Tab value="connections" disabled={dataLists.connections.length===0}>Connections</Tab>
					</TabList>
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
            </Tabs> 
		</Sheet>        
    )
  }

import { Box, Sheet, Tab, TabList, TabPanel, Tabs } from "@mui/joy";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";
import { ConfigDataLists } from "../../util/ConfigExplorer/ConfigData";
import { isArray } from "../../util/helpers";
import DataTable from "./DataTable";
import { tooltipCellRenderer } from "./SchemaTab";


function tableRenderer(prop: any) {
	return [prop.rowData.table?.catalog, prop.rowData.table?.db, prop.rowData.table?.name].filter(x => x).join(".");
}

function listRenderer(prop: any) {
	return (prop.value ? prop.value.join(", ") : prop.value);
}

function inputsRenderer(prop: any) {
	const v = prop.rowData.inputId || prop.rowData.inputIds
	return (isArray(v) ? v.join(", ") : v);
}	

function outputsRenderer(prop: any) {
	const v = prop.rowData.outputId || prop.rowData.outputIds
	return (isArray(v) ? v.join(", ") : v);
}	

const dataObjectColumns: any[] = [{
	title: 'Id',
	property: 'id',
	width: '200px'
  }, {
	title: 'Type',
	property: 'type',
	width: '150px'
}, {
	title: 'Table',
	property: 'table', // catalog/db/name is concatenated in renderer
	width: '200px',
	renderer: tableRenderer
}, {
	title: 'Table Catalog',
	property: 'table.catalog',
	width: '100px',
	visible: false
}, {
	title: 'Table Db',
	property: 'table.db',
	width: '100px',
	visible: false
}, {
	title: 'Table Name',
	property: 'table.name',
	width: '150px',
	visible: false
}, {
	title: 'Partitions',
	property: 'partitions',
	width: '100px',
	renderer: listRenderer
}, {
	title: 'Connection',
	property: 'connectionId',
	width: '150px'
}, {
	title: 'Path',
	property: 'path',
	width: '150px',
	renderer: tooltipCellRenderer()
}, {
	title: 'Description',
	property: 'metadata.description',
	width: '200px',
	renderer: tooltipCellRenderer()
}];

const actionColumns: any[] = [{
	title: 'Id',
	property: 'id',
	width: '200px'
  }, {
	title: 'Type',
	property: 'type',
	width: '150px'
}, {
	title: 'Feed',
	property: 'metadata.feed',
	width: '100px'
}, {
	title: 'Inputs',
	property: 'inputIds',
	width: '150px',
	renderer: inputsRenderer
}, {
	title: 'Outputs',
	property: 'outputIds',
	width: '150px',
	renderer: outputsRenderer
}, {
	title: 'Execution mode',
	property: 'executionMode.type',
	width: '100px',
	visible: false
}, {	
	title: 'Execution condition',
	property: 'executionCondition.expression',
	width: '100px',
	visible: false
}, {	
	title: 'Description',
	property: 'metadata.description',
	width: '200px',
	renderer: tooltipCellRenderer()
}];

const connectionColumns: any[] = [{
	title: 'Id',
	property: 'id',
	width: '200px'
}, {
	title: 'Type',
	property: 'type',
	width: '150px'
}, {
	title: 'Catalog',
	property: 'catalog',
	width: '100px'
}, {
	title: 'Db',
	property: 'db',
	width: '100px'
}, {
	title: 'Description',
	property: 'metadata.description',
	width: '200px',
	renderer: tooltipCellRenderer()
}];


export default function ElementTable(props: {dataLists: ConfigDataLists}) {
    const {dataLists} = props;
    const {elementType} = useParams();
	const {navigateContent} = useWorkspace();
    const [additionalToolbarElements, setAdditionalToolbarElements] = useState<JSX.Element>();

    return (
		<Sheet sx={{ flex: '1', height: '100%', display: 'flex', flexDirection: 'column', p: '1rem 0rem 1rem 0.5rem'}}>
			<Tabs size="md" value={elementType || "dataObjects"} onChange={(e,v) => navigateContent(`config/${v}`)} aria-label="element tabs" sx={{height: '100%'}}>
				<Sheet sx={{ display: 'flex'}}>
					<TabList size="md">
						<Tab value="dataObjects" disabled={dataLists.dataObjects.length===0}>Data Objects</Tab>
						<Tab value="actions" disabled={dataLists.actions.length===0}>Actions</Tab>
						<Tab value="connections" disabled={dataLists.connections.length===0}>Connections</Tab>
					</TabList>
					<Box flex={1}/>
					{additionalToolbarElements && additionalToolbarElements}
				</Sheet>
				<TabPanel value="dataObjects" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto', paddingTop: '10px'}}>
                    <DataTable data={dataLists.dataObjects} columns={dataObjectColumns} navigate={(row) => navigateContent(`config/dataObjects/${row.id}`)} keyAttr="id" name="dataObjects" setToolbarElements={setAdditionalToolbarElements}/>
				</TabPanel>
				<TabPanel value="actions" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto', paddingTop: '10px'}}>
                    <DataTable data={dataLists.actions} columns={actionColumns} navigate={(row) => navigateContent(`config/actions/${row.id}`)} keyAttr="id" name="actions" setToolbarElements={setAdditionalToolbarElements}/>
				</TabPanel>
				<TabPanel value="connections" className="content-panel" sx={{height: '100%', width: '100%', overflow: 'auto', paddingTop: '10px'}}>
                    <DataTable data={dataLists.connections} columns={connectionColumns} navigate={(row) => navigateContent(`config/connections/${row.id}`)} keyAttr="id" name="connections" setToolbarElements={setAdditionalToolbarElements}/>
				</TabPanel>
            </Tabs> 
		</Sheet>        
    )
  }

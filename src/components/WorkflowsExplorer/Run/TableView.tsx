import { ViewColumn, ViewColumnOutlined, ViewColumnRounded } from "@mui/icons-material";
import { Checkbox, Dropdown, Menu, MenuButton, MenuItem, Sheet, Typography } from "@mui/joy";
import { ITableInstance, SortDirection } from "ka-table";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { Row } from "../../../types";
import { createActionsChip } from "../../ConfigExplorer/ConfigurationTab";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer } from '../../ConfigExplorer/DataTable';
import useLocalStorageState from "../../../hooks/useLocalStorageState";


export const TableView = (props: { rows: Row[], stepName?: string, setToolbarElements: (lrElements: [JSX.Element?, JSX.Element?]) => void}) => {
    const [tableRef, setTableRef] = useState<ITableInstance>();
	const {navigateRel} = useWorkspace();
    const [columnsVisible, setColumnsVisible] = useLocalStorageState<any>("run.columnsVisible", {})

	function actionsLinkRenderer(prop: any) {
		return createActionsChip(prop.value, 'sm', {mt: -1});
	}
    
    const columns = useMemo(() => [{
		title: 'Action',
		property: 'step_name',
        renderer: actionsLinkRenderer,
	}, {
		title: 'Status',
		property: 'status',
		renderer: cellIconRenderer,
		width: '100px'
	}, {
		title: 'Start',
		property: 'started_at',
		renderer: (x) => dateRenderer(x),
		width: '175px',
        sortDirection: SortDirection.Ascend,
	}, {
		title: 'Finish',
		property: 'finished_at',
		renderer: (x) => dateRenderer(x),
		width: '175px',
	}, {
		title: 'Attempt',
		property: 'attempt_id',
		width: '80px'
	}, {
		title: 'Duration',
		property: 'duration',
		renderer: (x) => durationRenderer(x),
		width: '150px',
        visible: undefined
	}].map(c => ({...c, visible: columnsVisible[c.property]})), []);

    const columnsMenu = <>
        <Dropdown>
            <MenuButton size="sm" variant="plain"><ViewColumnOutlined/></MenuButton>               
            <Menu size="sm">
                {columns.map((col: any, index) => (
                    <MenuItem key={index}>
                        <Checkbox color="neutral" size="sm" variant="outlined" sx={{ mr: '0.5rem' }}
                            checked={(columnsVisible[col.property] ?? true)}
                            onChange={(x) => {
                                if (tableRef) {
                                    console.log("set visible", col.property, x.target.checked);
                                    if (x.target.checked) tableRef.showColumn(col.property);
                                    else tableRef.hideColumn(col.property);
                                    const newColumnsVisible = {...columnsVisible};
                                    newColumnsVisible[col.property] = x.target.checked;                                    
                                    setColumnsVisible(newColumnsVisible);
                                } else console.log("OOPS")
                            }}                            
                        />
                        <Typography>{col.title}</Typography>                        
                    </MenuItem>                
                ))}
            </Menu>
        </Dropdown>
    </>    

    useEffect(() => props.setToolbarElements([ undefined, columnsMenu ]), [columnsVisible, tableRef])
    
    return <><Sheet sx={{ height: '100%', backgroundColor: props.stepName ? 'primary.main' : 'none', opacity: props.stepName ? [0.4, 0.4, 0.4] : [], transition: 'opacity 0.2s ease-in-out', cursor: 'context-menu' }}>
        <DataTable data={props.rows} columns={columns} navigate={(row) => navigateRel((props.stepName ? `../${row.step_name}` : `${row.step_name}`))} keyAttr='step_name' useTableRef={setTableRef}/>
    </Sheet></>
}
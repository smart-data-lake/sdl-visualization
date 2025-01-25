import { ViewColumn, ViewColumnOutlined, ViewColumnRounded } from "@mui/icons-material";
import { Checkbox, Dropdown, Menu, MenuButton, MenuItem, Sheet, Typography } from "@mui/joy";
import { ITableInstance, SortDirection } from "ka-table";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { Row } from "../../../types";
import { createActionsChip } from "../../ConfigExplorer/ConfigurationTab";
import DataTable, { cellIconRenderer, dateRenderer, durationRenderer, getColumnSelectionMenu } from '../../ConfigExplorer/DataTable';
import useLocalStorageState from "../../../hooks/useLocalStorageState";


function actionsLinkRenderer(prop: any) {
    return createActionsChip(prop.value, 'sm', {mt: -1});
}

const columns = [{
    title: 'Action',
    property: 'step_name',
    renderer: actionsLinkRenderer,
    width: '200px'
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
    width: '150px'
}];

export const TableView = (props: { rows: Row[], stepName?: string, setToolbarElements: (lrElements: [JSX.Element?, JSX.Element?]) => void}) => {
	const {navigateRel} = useWorkspace();

    return <>
        <Sheet sx={{ height: '100%', backgroundColor: props.stepName ? 'primary.main' : 'none', opacity: props.stepName ? [0.4, 0.4, 0.4] : [], transition: 'opacity 0.2s ease-in-out', cursor: 'context-menu' }}>
            <DataTable data={props.rows} columns={columns} keyAttr='step_name' name="run" 
                navigate={(row) => navigateRel((props.stepName ? `../${row.step_name}` : `${row.step_name}`))} 
                setToolbarElements={(elements: JSX.Element) => props.setToolbarElements([undefined, elements])}
            />
        </Sheet>
    </>
}
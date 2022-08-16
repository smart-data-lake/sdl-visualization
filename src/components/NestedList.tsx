import * as React from 'react';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableView from '@mui/icons-material/TableView';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import Public from '@mui/icons-material/Public';
import LanIcon from '@mui/icons-material/Lan';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import TextField from '@mui/material/TextField';
import './ComponentsStyles.css';
import { connect } from 'http2';
import { Link } from "react-router-dom";
import { Box } from '@mui/material';


interface nestedListProps{
  data: any;
  sendSelectedElementToParent: React.Dispatch<React.SetStateAction<string>>;
  sendSelectedElementTypeToParent: React.Dispatch<React.SetStateAction<string>>;
  selectedElementToChild?: string;
  selectedElementTypeToChild?: string;
}

//props.data should be the JsonObject (already parsed from HOCON)
export default function NestedList(props: nestedListProps) {

  const allDataObjects = Object.keys(props.data.dataObjects).sort();
  const allActions = Object.keys(props.data.actions).sort();
  const allGlobal = Object.keys(props.data.global).sort();
  const allConnections = Object.keys(props.data.connections);

  const [openDataObjectsList, setOpenDataObjectsList] = React.useState(false);
  const [openActionsList, setOpenActionsList] = React.useState(false);
  const [openConnectionsList, setOpenConnectionsList] = React.useState(false);
  const [openGlobalList, setOpenGlobalList] = React.useState(false);
  const [currentDataObjects, setCurrentDataObjects] = React.useState(allDataObjects);
  const [currentActions, setCurrentActions] = React.useState(allActions);
  const [currentGlobal, setCurrentGlobal] = React.useState(allGlobal);
  const [currentConnections, setCurrentConnections] = React.useState(allConnections);
  const [currentSearch, setCurrentSearch] = React.useState('');
  const [selectedElement, setSelectedElement] = React.useState(props.selectedElementToChild);

  React.useEffect(()=>{
    setSelectedElement(props.selectedElementToChild);
  }, [props.selectedElementToChild]);

  const handleClickDataObjectsList = () => {
    setOpenDataObjectsList(!openDataObjectsList);
  };

  const handleClickActionsList = () => {
    setOpenActionsList(!openActionsList);
  };

  const handleClickConnectionsList = () => {
    setOpenConnectionsList(!openConnectionsList);
  };

  const handleTextField = (text: string) => {
    if (!openActionsList && !openDataObjectsList && !openConnectionsList) {
      setOpenActionsList(true);
      setOpenDataObjectsList(true);
      setOpenGlobalList(true);
      setOpenConnectionsList(true);
    }
    setCurrentSearch(text);
    const searchText = text.toLowerCase()
    const cdo = allDataObjects.filter(a => a.toLowerCase().includes(searchText));
    const ca = allActions.filter(a => a.toLowerCase().includes(searchText));
    const cg = allGlobal.filter(a => a.toLowerCase().includes(searchText));
    const cc = allConnections.filter(a => a.toLowerCase().includes(searchText));
    setCurrentDataObjects(cdo);
    setCurrentActions(ca);
    setCurrentGlobal(cg);
    setCurrentConnections(cc);
  }

  const handleClickOnElement = (element: string, elementType: string) => {
    props.sendSelectedElementToParent(element);
    props.sendSelectedElementTypeToParent(elementType);
    setSelectedElement(element);
  };

  function returnBoldString(dataObjectName: string){
    if (dataObjectName===selectedElement){return 'bolder';}
    else {return 'normal'}
  }

  const dataObjectsCompleteList = currentDataObjects.map((dataObject) => (
    <Link to={`/dataObjects/${dataObject}`}>
      <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(dataObject, 'dataObjects')}>
        <ListItemIcon>
          <TableViewTwoTone />
        </ListItemIcon>
        <ListItemText primary={dataObject}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
            fontWeight: returnBoldString(dataObject),
          }} />
      </ListItemButton>
    </Link>
  ));

  const actionsCompleteList = currentActions.map((action) => (
    <Link to={`/actions/${action}`}>
      <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(action, 'actions')}>
        <ListItemIcon>
          <RocketLaunchOutlined />
        </ListItemIcon>
        <ListItemText primary={action}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
            fontWeight: returnBoldString(action),
          }} />
      </ListItemButton>
    </Link>
  ));

  const connectionsCompleteList = currentConnections.map((connection) => (
    <Link to={`/connections/${connection}`}>
      <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(connection, 'connections')}>
        <ListItemIcon>
          <LanOutlinedIcon />
        </ListItemIcon>
        <ListItemText primary={connection}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
            fontWeight: returnBoldString(connection),
          }} />
      </ListItemButton>
    </Link>
  ));


  return (
    <Box sx={{"overflow-x": "clip"}}>
      <TextField
        className="search_field"
        variant="outlined"
        size="small"
        label="Search element"
        value={currentSearch}
        onChange={(e) => handleTextField(e.target.value)} //e is the event Object triggered by the onChange
        sx={{width: "100%", "padding-right": "25px"}}
      />

      <List
        sx={{ width: '100%', bgcolor: 'background.paper' }}
        component="nav"
        aria-labelledby="nested-list-subheader"
        /*subheader={
          <ListSubheader component="div" id="nested-list-subheader">
            Configuration File
          </ListSubheader>
        }*/
      >
        <ListItemButton onClick={handleClickDataObjectsList}>
          <ListItemIcon>
            <TableView />
          </ListItemIcon>
          <ListItemText primary="Data Objects" primaryTypographyProps={{noWrap: true}}/>
          {openDataObjectsList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openDataObjectsList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding dense={true}>
            {dataObjectsCompleteList}
          </List>
        </Collapse>
        <ListItemButton onClick={handleClickActionsList}>
          <ListItemIcon>
            <RocketLaunch />
          </ListItemIcon>
          <ListItemText primary="Actions" primaryTypographyProps={{noWrap: true}}/>
          {openActionsList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openActionsList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding dense={true}>
            {actionsCompleteList}
          </List>
        </Collapse>
        <ListItemButton onClick={handleClickConnectionsList}>
          <ListItemIcon>
            <LanIcon />
          </ListItemIcon>
          <ListItemText primary="Connections" primaryTypographyProps={{noWrap: true}}/>
          {openConnectionsList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openConnectionsList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding dense={true}>
            {connectionsCompleteList}
          </List>
        </Collapse>
        <Link to='/globalOptions'>
          <ListItemButton onClick={() => handleClickOnElement('global', 'global')}>
            <ListItemIcon>
              <Public />
            </ListItemIcon>
            <ListItemText primary="Global Options" primaryTypographyProps={{ noWrap: true, fontWeight: returnBoldString('global')}}/>
          </ListItemButton>
        </Link>
      </List>
    </Box>
  );
}
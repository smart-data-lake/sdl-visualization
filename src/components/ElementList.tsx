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
import { Link, useMatch } from "react-router-dom";
import { Box } from '@mui/material';


interface ElementListProps{
  data: any;
}

//props.data should be the JsonObject (already parsed from HOCON)
export default function ElementList(props: ElementListProps) {

  const allDataObjects = Object.keys(props.data.dataObjects).sort();
  const allActions = Object.keys(props.data.actions).sort();
  let allConnections : string[] = [];
  if (Object.keys(props.data).includes('connections')){
    allConnections = Object.keys(props.data.connections);
  }
  const [openDataObjectsList, setOpenDataObjectsList] = React.useState(false);
  const [openActionsList, setOpenActionsList] = React.useState(false);
  const [openConnectionsList, setOpenConnectionsList] = React.useState(false);
  const [currentDataObjects, setCurrentDataObjects] = React.useState(allDataObjects);
  const [currentActions, setCurrentActions] = React.useState(allActions);
  const [currentConnections, setCurrentConnections] = React.useState(allConnections);
  const [currentSearch, setCurrentSearch] = React.useState('');
  const urlParams = useMatch('/:elementType/:elementName');

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
      setOpenConnectionsList(true);
    }
    setCurrentSearch(text);
    const searchText = text.toLowerCase()
    const cdo = allDataObjects.filter(a => a.toLowerCase().includes(searchText));
    const ca = allActions.filter(a => a.toLowerCase().includes(searchText));
    const cc = allConnections.filter(a => a.toLowerCase().includes(searchText));
    setCurrentDataObjects(cdo);
    setCurrentActions(ca);
    setCurrentConnections(cc);
  }

  function returnBoldString(elementType:string, elementName: string){
    if (urlParams?.params.elementType===elementType && urlParams?.params.elementName===elementName) return 'bolder';
    else return 'normal';
  }

  const dataObjectsCompleteList = currentDataObjects.map((dataObject) => (
    <Link to={`/dataObjects/${dataObject}`}>
      <ListItemButton sx={{ pl: 4 }}>
        <ListItemIcon>
          <TableViewTwoTone />
        </ListItemIcon>
        <ListItemText primary={dataObject}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
            fontWeight: returnBoldString("dataObjects", dataObject),
          }} />
      </ListItemButton>
    </Link>
  ));

  const actionsCompleteList = currentActions.map((action) => (
    <Link to={`/actions/${action}`}>
      <ListItemButton sx={{ pl: 4 }}>
        <ListItemIcon>
          <RocketLaunchOutlined />
        </ListItemIcon>
        <ListItemText primary={action}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
            fontWeight: returnBoldString("actions", action),
          }} />
      </ListItemButton>
    </Link>
  ));

  const connectionsCompleteList = currentConnections.map((connection) => (
    <Link to={`/connections/${connection}`}>
      <ListItemButton sx={{ pl: 4 }}>
        <ListItemIcon>
          <LanOutlinedIcon />
        </ListItemIcon>
        <ListItemText primary={connection}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
            fontWeight: returnBoldString("connections", connection),
          }} />
      </ListItemButton>
    </Link>
  ));


  return (
    <Box sx={{"overflowX": "clip"}}>
      <TextField
        className="search_field"
        variant="outlined"
        size="small"
        label="Search element"
        value={currentSearch}
        onChange={(e) => handleTextField(e.target.value)} //e is the event Object triggered by the onChange
        sx={{width: "100%", "paddingRight": "25px"}}
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
          <ListItemButton>
            <ListItemIcon>
              <Public />
            </ListItemIcon>
            <ListItemText primary="Global Options" primaryTypographyProps={{ noWrap: true}}/>
          </ListItemButton>
        </Link>
      </List>
    </Box>
  );
}
import * as React from 'react';
import ListSubheader from '@mui/material/ListSubheader';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import StarBorder from '@mui/icons-material/StarBorder';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableView from '@mui/icons-material/TableView';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import Public from '@mui/icons-material/Public';
import TravelExplore from '@mui/icons-material/TravelExplore';
import TextField from '@mui/material/TextField';
import './ComponentsStyles.css';


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

  const [openDataObjectsList, setOpenDataObjectsList] = React.useState(false);
  const [openActionsList, setOpenActionsList] = React.useState(false);
  const [openGlobalList, setOpenGlobalList] = React.useState(false);
  const [currentDataObjects, setCurrentDataObjects] = React.useState(allDataObjects);
  const [currentActions, setCurrentActions] = React.useState(allActions);
  const [currentGlobal, setCurrentGlobal] = React.useState(allGlobal);
  const [currentSearch, setCurrentSearch] = React.useState('');

  const handleClickDataObjectsList = () => {
    setOpenDataObjectsList(!openDataObjectsList);
  };

  const handleClickActionsList = () => {
    setOpenActionsList(!openActionsList);
  };

  const handleClickGlobalList = () => {
    setOpenGlobalList(!openGlobalList);
  };

  const handleTextField = (text: string) => {
    if (!openActionsList && !openDataObjectsList && !openGlobalList) {
      setOpenActionsList(true);
      setOpenDataObjectsList(true);
      setOpenGlobalList(true);
    }
    setCurrentSearch(text);
    const searchText = text.toLowerCase()
    const cdo = allDataObjects.filter(a => a.toLowerCase().includes(searchText));
    const ca = allActions.filter(a => a.toLowerCase().includes(searchText));
    const cg = allGlobal.filter(a => a.toLowerCase().includes(searchText));
    setCurrentDataObjects(cdo);
    setCurrentActions(ca);
    setCurrentGlobal(cg);
  }

  const handleClickOnElement = (element: string, elementType: string) => {
    props.sendSelectedElementToParent(element);
    props.sendSelectedElementTypeToParent(elementType);
  };

  const dataObjectsCompleteList = currentDataObjects.map((dataObject) => (
    <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(dataObject, 'dataObjects') }>
      <ListItemIcon>
        <TableViewTwoTone />
      </ListItemIcon>
      <ListItemText primary={dataObject}                   
        primaryTypographyProps={{
          lineHeight: '16px',
          noWrap: true,
        }}/>
    </ListItemButton>
  ));

  const actionsCompleteList = currentActions.map((action) => (
    <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(action, 'actions') }>
      <ListItemIcon>
        <RocketLaunchOutlined />
      </ListItemIcon>
      <ListItemText primary={action}
        primaryTypographyProps={{
          lineHeight: '16px',
          noWrap: true,
        }}/>    
    </ListItemButton>
  ));

  const optionsCompleteList = currentGlobal.map((option) => (
    <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(option, 'global') }>
      <ListItemIcon>
        <TravelExplore />
      </ListItemIcon>
      <ListItemText primary={option} 
        primaryTypographyProps={{
          lineHeight: '16px',
          noWrap: true,
        }}/>
    </ListItemButton>
  ));


  return (
    <div>
      <TextField
        className="search_field"
        variant="outlined"
        size="small"
        label="Search element"
        value={currentSearch}
        onChange={(e) => handleTextField(e.target.value)} //e is the event Object triggered by the onChange
      />

      <List
        sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
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
        <ListItemButton onClick={handleClickGlobalList}>
          <ListItemIcon>
            <Public />
          </ListItemIcon>
          <ListItemText primary="Global Options" primaryTypographyProps={{noWrap: true}}/>
          {openGlobalList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openGlobalList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding dense={true}>
            {optionsCompleteList}
          </List>
        </Collapse>
      </List>
    </div>
  );
}
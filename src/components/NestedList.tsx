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
  setDisplayMode: React.Dispatch<React.SetStateAction<string>>;
  sendSelectedElementToParent: React.Dispatch<React.SetStateAction<string>>;
  sendSelectedElementTypeToParent: React.Dispatch<React.SetStateAction<string>>;
  selectedElementToChild?: string;
  selectedElementTypeToChild?: string;
}

//props.data should be the JsonObject (already parsed from HOCON)
export default function NestedList(props: nestedListProps) {
  const [openDataObjectsList, setOpenDataObjectsList] = React.useState(false);
  const [openActionsList, setOpenActionsList] = React.useState(false);
  const [openGlobalList, setOpenGlobalList] = React.useState(false);
  const [currentDataObjects, setCurrentDataObjects] = React.useState(Object.keys(props.data.dataObjects));
  const [currentActions, setCurrentActions] = React.useState(Object.keys(props.data.actions));
  const [currentGlobal, setCurrentGlobal] = React.useState(Object.keys(props.data.global));
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
    setOpenActionsList(true);
    setOpenDataObjectsList(true);
    setOpenGlobalList(true);
    setCurrentSearch(text);
    var cdo = Object.keys(props.data.dataObjects).filter(a => a.toLowerCase().includes(text.toLowerCase()));
    var ca = Object.keys(props.data.actions).filter(a => a.toLowerCase().includes(text.toLowerCase()));
    var cg = Object.keys(props.data.global).filter(a => a.toLowerCase().includes(text.toLowerCase()));
    setCurrentDataObjects(cdo);
    setCurrentActions(ca);
    setCurrentGlobal(cg);
  }

  const handleClickOnElement = (element: string, elementType: string) => {
    props.setDisplayMode('table');
    props.sendSelectedElementToParent(element);
    props.sendSelectedElementTypeToParent(elementType);
  };

  const dataObjectsCompleteList = currentDataObjects.map((dataObject) => (
    <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(dataObject, 'dataObjects') }>
    <ListItemIcon>
      <TableViewTwoTone />
    </ListItemIcon>
    <ListItemText primary={dataObject} />
  </ListItemButton>
  ));

  const actionsCompleteList = currentActions.map((action) => (
    <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(action, 'actions') }>
    <ListItemIcon>
      <RocketLaunchOutlined />
    </ListItemIcon>
    <ListItemText primary={action} />
  </ListItemButton>
  ));

  const optionsCompleteList = currentGlobal.map((option) => (
    <ListItemButton sx={{ pl: 4 }} onClick={() => handleClickOnElement(option, 'global') }>
    <ListItemIcon>
      <TravelExplore />
    </ListItemIcon>
    <ListItemText primary={option} />
  </ListItemButton>
  ));


  return (
    <div>
      <TextField
        className="search_field"
        variant="outlined"
        label="Search element"
        value={currentSearch}
        onChange={(e) => handleTextField(e.target.value)} //e is the event Object triggered by the onChange
      />

      <List
        sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
        component="nav"
        aria-labelledby="nested-list-subheader"
        subheader={
          <ListSubheader component="div" id="nested-list-subheader">
            Configuration File
          </ListSubheader>
        }
      >
        <ListItemButton onClick={handleClickDataObjectsList}>
          <ListItemIcon>
            <TableView />
          </ListItemIcon>
          <ListItemText primary="Data Objects" />
          {openDataObjectsList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openDataObjectsList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {dataObjectsCompleteList}
          </List>
        </Collapse>
        <ListItemButton onClick={handleClickActionsList}>
          <ListItemIcon>
            <RocketLaunch />
          </ListItemIcon>
          <ListItemText primary="Actions" />
          {openActionsList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openActionsList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {actionsCompleteList}
          </List>
        </Collapse>
        <ListItemButton onClick={handleClickGlobalList}>
          <ListItemIcon>
            <Public />
          </ListItemIcon>
          <ListItemText primary="Global Options" />
          {openGlobalList ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={openGlobalList} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {optionsCompleteList}
          </List>
        </Collapse>
      </List>
    </div>
  );
}
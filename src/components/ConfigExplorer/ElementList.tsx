import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LanIcon from '@mui/icons-material/Lan';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import Public from '@mui/icons-material/Public';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableView from '@mui/icons-material/TableView';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import { Box } from '@mui/material';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import * as React from 'react';
import { Link, useMatch, useNavigate } from "react-router-dom";
import { ConfigData, ConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import { transformOrDefault } from '../../util/helpers';
import './ComponentsStyles.css';


interface ElementListProps{
  configData?: ConfigData;
  configDataLists: ConfigDataLists;
  width: number;
  mainRef: React.Ref<HTMLDivElement>;
  setFilter: (string) => void;
}

//props.data should be the JsonObject (already parsed from HOCON)
export default function ElementList(props: ElementListProps) {

  const {configDataLists} = props;

  const urlParamsType = useMatch('/config/:elementType');
  const urlParamsElement = useMatch('/config/:elementType/:elementName');
  const elementType = urlParamsElement?.params.elementType || urlParamsType?.params.elementType;
  const elementName = urlParamsElement?.params.elementName;

  const [openDataObjectsList, setOpenDataObjectsList] = React.useState(isSelected("dataObjects"));
  const [openActionsList, setOpenActionsList] = React.useState(isSelected("actions"));
  const [openConnectionsList, setOpenConnectionsList] = React.useState(isSelected("connections"));
  const navigate = useNavigate();

  function handleClickNavigate(to: string) {
    return (ev: React.MouseEvent<HTMLDivElement>) => {
      ev.stopPropagation();
      navigate(to);
    }
  };

  const handleTextField = (text: string) => {
    if (!openActionsList && !openDataObjectsList && !openConnectionsList) {
      setOpenActionsList(true);
      setOpenDataObjectsList(true);
      setOpenConnectionsList(true);
    }
    props.setFilter(text);
  }

  function isSelected(type: string, name?: string) {
    return (type===elementType && name===elementName)
  }

  function primaryColorIfSelected(type: string, name?: string) {
    return (isSelected(type, name) ? 'primary.main': '')
  }

  const dataObjectsCompleteList = transformOrDefault(configDataLists, d => d.dataObjects
  .map(obj => obj.id)
  .map((obj,i) => (
    <Link to={`/config/dataObjects/${obj}`} key={"d"+i}>
      <ListItemButton sx={{ pl: '1rem', paddingRight: '0px', color: primaryColorIfSelected('dataObjects', obj)}}>
        <ListItemIcon sx={{ minWidth: '40px', color: primaryColorIfSelected('dataObjects', obj)}}>
          <TableViewTwoTone />
        </ListItemIcon>
        <ListItemText primary={obj}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
          }} />
      </ListItemButton>
    </Link>
  )), []);

  const actionsCompleteList = transformOrDefault(configDataLists, d => d.actions
  .map(obj => obj.id)
  .map((obj,i) => (
    <Link to={`/config/actions/${obj}`} key={"a"+i}>
      <ListItemButton sx={{ pl: '1rem', paddingRight: '0px', color: primaryColorIfSelected('actions', obj)}}>
        <ListItemIcon sx={{ minWidth: '40px', color: primaryColorIfSelected('actions', obj)}}>
          <RocketLaunchOutlined />
        </ListItemIcon>
        <ListItemText primary={obj}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
          }} />
      </ListItemButton>
    </Link>
  )), []);

  const connectionsCompleteList = transformOrDefault(configDataLists, d => d.connections
  .map(obj => obj.id)
  .map((obj,i) => (
    <Link to={`/config/connections/${obj}`} key={'c'+i}>
      <ListItemButton sx={{ pl: '1rem', paddingRight: '0px', color: primaryColorIfSelected('connections', obj)}}>
        <ListItemIcon sx={{ minWidth: '40px', color: primaryColorIfSelected('connections', obj)}}>
          <LanOutlinedIcon />
        </ListItemIcon>
        <ListItemText primary={obj}
          primaryTypographyProps={{
            lineHeight: '16px',
            noWrap: true,
          }} />
      </ListItemButton>
    </Link>
  )), []);

  return (
    <Box sx={{width: props.width, minWidth: '100px', maxWidth: '500px', height: '100%', pt:'1rem'}} ref={props.mainRef}>
      <TextField
        className="search_field"
        variant="outlined"
        size="small"
        label="Search element"
        onChange={(e) => handleTextField(e.target.value)} //e is the event Object triggered by the onChange
        sx={{width: "100%", paddingRight: "10px"}}
      />

      <List
        sx={{ width: '100%', bgcolor: 'background.paper' }}
        component="nav"
        aria-labelledby="nested-list-subheader"
      >
        <ListItemButton onClick={() => setOpenDataObjectsList(!openDataObjectsList)} sx={{ paddingRight: '0px', color: primaryColorIfSelected('dataObjects') }} disabled={configDataLists.dataObjects.length===0}>
          <ListItemIcon onClick={handleClickNavigate(`/config/dataObjects`)} sx={{ minWidth: '40px', color: primaryColorIfSelected('dataObjects')}}>
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
        <ListItemButton onClick={() => setOpenActionsList(!openActionsList)} sx={{ paddingRight: '0px', color: primaryColorIfSelected('actions') }} disabled={configDataLists.actions.length===0}>
          <ListItemIcon onClick={handleClickNavigate(`/config/actions`)} sx={{ minWidth: '40px', color: primaryColorIfSelected('actions')}}>
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
        <ListItemButton onClick={() => setOpenConnectionsList(!openConnectionsList)} sx={{ paddingRight: '0px', color: primaryColorIfSelected('connections') }} disabled={configDataLists.connections.length===0}>
          <ListItemIcon onClick={handleClickNavigate(`/config/connections`)} sx={{ minWidth: '40px', color: primaryColorIfSelected('connections')}}>
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
        <Link to='/config/globalOptions'>
          <ListItemButton disabled={!props.configData?.global} sx={{color: primaryColorIfSelected('globalOptions')}}>
            <ListItemIcon sx={{ minWidth: '40px', color: primaryColorIfSelected('globalOptions')}}>
              <Public />
            </ListItemIcon>
            <ListItemText primary="Global Options" primaryTypographyProps={{ noWrap: true}}/>
          </ListItemButton>
        </Link>
      </List>
    </Box>
  );
}
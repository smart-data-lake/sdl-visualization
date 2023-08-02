import { SchemaOutlined, SearchOutlined } from '@mui/icons-material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LanIcon from '@mui/icons-material/Lan';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import Public from '@mui/icons-material/Public';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableView from '@mui/icons-material/TableView';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import Divider from '@mui/joy/Divider';
import Input from '@mui/joy/Input';
import Option from '@mui/joy/Option';
import Select from '@mui/joy/Select';
import Tooltip from '@mui/joy/Tooltip';
import { Box } from '@mui/material';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import * as React from 'react';
import { Link, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { ConfigData, ConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import { transformOrDefault } from '../../util/helpers';
import './ComponentsStyles.css';

interface ElementListProps{
  configData?: ConfigData;
  configDataLists: ConfigDataLists;
  width: number;
  mainRef: React.Ref<HTMLDivElement>;
  setFilter: (SearchFilterDef) => void;
}

//props.data should be the JsonObject (already parsed from HOCON)
export default function ElementList(props: ElementListProps) {

  const {configDataLists} = props;

  const urlParamsType = useMatch('/config/:elementType');
  const urlParamsElement = useMatch('/config/:elementType/:elementName');
  const elementType = urlParamsElement?.params.elementType || urlParamsType?.params.elementType;
  const elementName = urlParamsElement?.params.elementName;
  const [urlSearchParams] = useSearchParams();
  const elementSearchTextParam = urlSearchParams.get('elementSearch') || '';
  const elementSearchTypeParam = urlSearchParams.get('elementSearchType') || '';

  const [openDataObjectsList, setOpenDataObjectsList] = React.useState(isSelected("dataObjects"));
  const [openActionsList, setOpenActionsList] = React.useState(isSelected("actions"));
  const [openConnectionsList, setOpenConnectionsList] = React.useState(isSelected("connections"));
  const [elementSearchText, setElementSearchText] = React.useState<string>('');
  const [elementSearchType, setElementSearchType] = React.useState<string>("id");
  const navigate = useNavigate();

  React.useEffect(() => {  
    if (elementSearchTextParam) {
      setElementSearchText(elementSearchTextParam);
      console.log("setElementSearchText param", elementSearchText, elementSearchTextParam);
    }
  }, [elementSearchTextParam]);

  React.useEffect(() => {  
    if (elementSearchTypeParam && elementSearchType !== elementSearchTypeParam) {
      setElementSearchType(elementSearchTypeParam);
    }
  }, [elementSearchTypeParam]);

  function handleClickNavigate(to: string) {
    return (ev: React.MouseEvent<HTMLDivElement>) => {
      ev.stopPropagation();
      navigate(to);
    }
  }

  //function handleElementSearchTextChange(text: string|null) {
  React.useEffect(() => {  
    if (!openActionsList && !openDataObjectsList && !openConnectionsList) {
      setOpenActionsList(true);
      setOpenDataObjectsList(true);
      setOpenConnectionsList(true);
    }
    props.setFilter({text: elementSearchText, type: elementSearchType});
  }, [elementSearchType, elementSearchText]);

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
    <Box sx={{width: props.width, minWidth: '100px', maxWidth: '500px', height: '100%', pt:'1rem', overflowY: 'auto'}} ref={props.mainRef}>
      <Input
        placeholder="Search element"
        sx={{width: "100% - 10px", marginLeft: "10px"}}
        value={elementSearchText}
        onChange={(e) => setElementSearchText(e.target.value)}
        endDecorator={
          <>
            <Divider orientation="vertical" />
            <Select size="sm" variant="plain"
              value={elementSearchType}
              onChange={(e, value) => {if (value) setElementSearchType(value)}}
              sx={{ mr: -1.5, '&:hover': { bgcolor: 'transparent' }, '& .MuiSelect-indicator': {marginLeft: '0px'} }}
            >
              <Option value="id">
                <Tooltip arrow title='Search elements where id contains search text (case insensitive).' enterDelay={500} enterNextDelay={500} placement='right'>
                  <SearchOutlined/>
                </Tooltip>
              </Option>
              <Option value="property">
                <Tooltip arrow title='Search elements where given property is matched by regular expression. Use convention "propertyName:regex".' enterDelay={500} enterNextDelay={500} placement='right'>
                  <SchemaOutlined/>
                </Tooltip>
              </Option>
              {/*
              <Option value="feedSel">
                <Tooltip arrow title='Search Actions and dependent objects with semantics of command line "feedSel" parameter.' enterDelay={500} enterNextDelay={500} placement='right'>
                  <AltRouteIcon />
                </Tooltip>
              </Option>
              */}
            </Select>
          </>
        }        
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
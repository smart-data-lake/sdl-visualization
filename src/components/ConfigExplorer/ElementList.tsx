import { SchemaOutlined, SearchOutlined } from '@mui/icons-material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LanIcon from '@mui/icons-material/Lan';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import Public from '@mui/icons-material/Public';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableView from '@mui/icons-material/TableView';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import { Box, List, ListItemButton, ListItemContent, ListItemDecorator, Typography } from '@mui/joy';
import Divider from '@mui/joy/Divider';
import Input from '@mui/joy/Input';
import Option from '@mui/joy/Option';
import Select, { SelectOption } from '@mui/joy/Select';
import Tooltip from '@mui/joy/Tooltip';
import * as React from 'react';
import { useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { ConfigData, ConfigDataLists, emptyConfigDataLists } from '../../util/ConfigExplorer/ConfigData';
import './ComponentsStyles.css';
import { applyFilter } from './ConfigExplorer';

interface ElementListProps{
  configData?: ConfigData;
  configDataLists: ConfigDataLists;
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
  const [elementSearchTextErr, setElementSearchTextErr] = React.useState<string|null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {  
    if (elementSearchTextParam) {
      setElementSearchText(elementSearchTextParam);      
    }
  }, [elementSearchTextParam]);

  React.useEffect(() => {  
    if (elementSearchTypeParam && elementSearchType !== elementSearchTypeParam) {
      setElementSearchType(elementSearchTypeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementSearchTypeParam]);

  function handleClickNavigate(to: string) {
    return (ev: React.MouseEvent<HTMLDivElement>) => {
      ev.stopPropagation();
      navigate(to);
    }
  }

  React.useEffect(() => {
    const filter = {text: elementSearchText, type: elementSearchType};
    try {
      // validate
      applyFilter(emptyConfigDataLists, filter);
      if (!openActionsList && !openDataObjectsList && !openConnectionsList) {
        setOpenActionsList(true);
        setOpenDataObjectsList(true);
        setOpenConnectionsList(true);
      }
      setElementSearchTextErr(null);
      props.setFilter(filter);
    } catch (err: any) {
      setElementSearchTextErr(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementSearchType, elementSearchText]);

  function isSelected(type: string, name?: string) {
    return (type===elementType && name===elementName)
  }

  function primaryColorIfSelected(type: string, name?: string) {
    console.log(type,elementType, name, elementName);
    return (isSelected(type, name) ? 'primary': 'neutral')
  }

  const sectionsDef = [
    {
      id: 'dataObjects',
      title: 'Data Objects',
      sectionIcon: TableView,
      elementList: {
        expanded: openDataObjectsList,
        setExpanded: setOpenDataObjectsList,
        elementIcon: TableViewTwoTone,
        elements: configDataLists.dataObjects || []    
      }
    }, {
      id: 'actions',
      title: 'Actions',
      sectionIcon: RocketLaunch,
      elementList: {
        expanded: openActionsList,
        setExpanded: setOpenActionsList,
        elementIcon: RocketLaunchOutlined,
        elements: configDataLists.actions || []    
      }
    }, {
      id: 'connections',
      title: 'Connections',
      sectionIcon: LanIcon,
      elementList: {
        expanded: openConnectionsList,
        setExpanded: setOpenConnectionsList,
        elementIcon: LanOutlinedIcon,
        elements: configDataLists.connections || []    
      }
    }, {
      id: 'globalOptions',
      title: 'Global Options',
      sectionIcon: Public,
    }, 
  ]

  function createElementList(id: string, listDef: {elementIcon: any, elements: any[]}) {
    return listDef.elements
      .map((obj,i) => {
        const color = primaryColorIfSelected(id, obj.id)
        return (
          <ListItemButton color={color} key={obj.id} onClick={handleClickNavigate(`/config/${id}/${obj.id}`)} sx={{ pl: '0.75rem', pr: '0px', pt: '0px', pb: '0px', minHeight: '22px'}}>
            <ListItemDecorator sx={{ minWidth: '25px'}}>
              {React.createElement(listDef.elementIcon, {})}
            </ListItemDecorator>
            <ListItemContent><Typography level='body-sm' noWrap color={color}>{obj.id}</Typography></ListItemContent>
          </ListItemButton>
        )
      })
  }

  function createSection(listDef: {id: string, title: string, sectionIcon: any, elementList?: {expanded: boolean, setExpanded: (boolean) => void, elementIcon: any, elements: any[]}}) {
    const isEmpty = !listDef.elementList || (listDef.elementList && listDef.elementList.elements.length == 0);
    const isDisabled = listDef.elementList && isEmpty
    const color = primaryColorIfSelected(listDef.id)
    const expandClick = () => {
      if (listDef.elementList) listDef.elementList!.setExpanded(!listDef.elementList!.expanded)
      else navigate(`/config/${listDef.id}`)
    }
    return (<>
      <ListItemButton color={color} key={listDef.id} onClick={expandClick} sx={{ pl: '0px', pr: '0px', pb: '0px', minHeight: '25px', color: primaryColorIfSelected(listDef.id) }} disabled={isDisabled}>
        <ListItemDecorator sx={{ minWidth: '27px'}}>
          {React.createElement(listDef.sectionIcon, {onClick: handleClickNavigate(`/config/${listDef.id}`)})}
        </ListItemDecorator>
        <ListItemContent><Typography noWrap color={color}>{listDef.title}</Typography></ListItemContent>
        {!isEmpty && (listDef.elementList!.expanded ? <ExpandLess /> : <ExpandMore />)}
      </ListItemButton>
      {!isEmpty && listDef.elementList!.expanded &&  (
        <List size='sm'>
          {createElementList(listDef.id, listDef.elementList!)}
        </List>
      )}
    </>)
  }

  function getSearchTypeElement(value: string) {
    const options = {
      id:
        <Tooltip arrow title='Search elements where id contains search text (case insensitive).' enterDelay={500} enterNextDelay={500} placement='right'>
          <SearchOutlined/>
        </Tooltip>,
      property:
        <Tooltip arrow title='Search elements where given property is matched by regular expression. Use convention "propertyName:regex".' enterDelay={500} enterNextDelay={500} placement='right'>
          <SchemaOutlined/>
        </Tooltip>,
      feedSel: 
        <Tooltip arrow title='Search Actions and dependent objects with semantics of command line "feedSel" parameter.' enterDelay={500} enterNextDelay={500} placement='right'>
          <AltRouteIcon />
        </Tooltip>    
    }
    return options[value];
  }
  
  function renderSearchType(option: SelectOption<string> | null) {
    if (!option) return null;
    return getSearchTypeElement(option.value);
  }

  return (
    <Box sx={{minWidth: '100px', maxWidth: '500px', height: '100%', pt:'1rem', overflowY: 'auto'}} ref={props.mainRef}>
      <Tooltip arrow title={`Search text for type=${elementSearchType} not valid: ${elementSearchTextErr}`} placement='bottom' color="danger" open={(elementSearchTextErr ? true : false)} variant="soft">
      <Input
        placeholder="Search element"
        sx={{paddingRight: '0px'}}
        value={elementSearchText}
        onChange={(e) => setElementSearchText(e.target.value)}
        error={(elementSearchTextErr ? true : false)}
        endDecorator={
          <>
            <Divider orientation="vertical" />
            <Select size="sm" variant="plain" value={elementSearchType} required
              onChange={(e,value) => setElementSearchType(value!)}
              renderValue={renderSearchType}
            >
              <Option value="id">{getSearchTypeElement('id')}</Option>
              <Option value="property">{getSearchTypeElement('property')}</Option>
              <Option value="feedSel">{getSearchTypeElement('feedSel')}</Option>
            </Select>
          </>
        }        
      />
      </Tooltip>

      <List size="md" sx={{width: '100%'}}>
        {sectionsDef.map(sectionDef => createSection(sectionDef))}
      </List>
    </Box>
  );
}
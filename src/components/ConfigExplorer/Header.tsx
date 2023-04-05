import { RocketLaunchOutlined, TableViewTwoTone } from '@mui/icons-material';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import {AppBar, Toolbar, IconButton, Typography, Icon} from '@mui/material';
import { useMatch } from 'react-router-dom';

export default function Header() {
  const urlParams = useMatch('/:elementType/:elementName');

  //TODO: should be reused in NestedList
  function typeIcon() {
    if (urlParams?.params.elementType === "dataObjects") return <Icon><TableViewTwoTone /></Icon>;
    if (urlParams?.params.elementType === "actions") return <Icon><RocketLaunchOutlined /></Icon>;
    if (urlParams?.params.elementType === "connections") return <Icon><LanOutlinedIcon /></Icon>;
  }

  function getElementDesc() {
    if (urlParams?.params.elementName) return <span>&nbsp;&nbsp;|&nbsp;&nbsp;{typeIcon()}&nbsp;{urlParams.params.elementName}</span>;
    else return "";
  }

  return (
      <AppBar component="nav" position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }}>
          <img src="/sdl_logo192.png" alt="logo" className="logo" height="32px" />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Configuration Viewer{getElementDesc()}
        </Typography>
      </Toolbar>
    </AppBar>    
  );
}
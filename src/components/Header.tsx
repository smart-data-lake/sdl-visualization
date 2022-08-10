import {AppBar, Toolbar, IconButton, Typography} from '@mui/material';

export default function Header() {
    return (
        <AppBar component="nav" position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }}>
            <img src="sdl_logo.png" alt="logo" className="logo" height="32px" />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Configuration Viewer
          </Typography>
        </Toolbar>
      </AppBar>    
    );
}
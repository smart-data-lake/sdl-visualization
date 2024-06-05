import {
  Box,
  Grid,
  List,
  ListItem,
  ListItemButton,
  Sheet,
  colors,
} from "@mui/joy";
import PageHeader from "../../layouts/PageHeader";
import { Link, Navigate, Route, Routes, useMatch } from "react-router-dom";
import Users from "./Users";

const settingMenuItems = [{ title: "User Management", path: "users" }];

const NavLink = ({ to, title }) => {
  const activated = useMatch(`settings/${to}`);

  return (
    <ListItemButton selected={!!activated}>
      <Link to={to}>{title}</Link>
    </ListItemButton>
  );
};

export default function Setting() {
  return (
    <Sheet
      sx={{
        display: "flex",
        width: "100%",
        height: "100%",
        p: "0.1rem 1rem",
        flexDirection: "column",
      }}
    >
      <PageHeader title={"Setting"} noBack={true} />
      <Sheet sx={{ display: "flex", width: "100%", minHeight: 0, flexGrow: 1 }}>
        <Grid container height="100%">
          <Grid xs={2}>
            <Box
              borderRight={`1px solid ${colors.grey[200]}`}
              pr={2}
              mr={2}
              height="100%"
            >
              <List>
                {settingMenuItems.map((x) => (
                  <ListItem key={x.path}>
                    <NavLink to={x.path} title={x.title}></NavLink>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Grid>
          <Grid xs={10}>
            <Routes>
              <Route path="users" element={<Users />} />
              <Route path="*" element={<Navigate to="users" replace={true} />} />
            </Routes>
          </Grid>
        </Grid>
      </Sheet>
    </Sheet>
  );
}

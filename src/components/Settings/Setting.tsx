import {
  Box,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemButton,
  Sheet,
  Stack,
  Typography,
  colors,
} from "@mui/joy";
import PageHeader from "../../layouts/PageHeader";
import { Link, Navigate, Route, Routes, useMatch } from "react-router-dom";
import Users from "./Users";
import { useFetchLicenses } from "../../hooks/useFetchData";

const settingMenuItems = [{ title: "User Management", path: "users" }];

const NavLink = ({ to, title }) => {
  const activated = useMatch(`settings/${to}`);

  return (
    <ListItemButton selected={!!activated}>
      <Link to={to}>{title}</Link>
    </ListItemButton>
  );
};

const TenantLicenses = () => {
  const { data: licenses, isLoading, error } = useFetchLicenses();
  return (
    <Stack
      direction="row"
      spacing={4}
      sx={{
        justifyContent: "flex-end",
        alignItems: "center",
        pt: "1rem",
      }}
    >
      {isLoading ? (
        <CircularProgress size="sm" />
      ) : (
        <>
          {licenses?.licensedRepos != undefined && licenses?.licensedRepos != null && (
            <Typography level="title-md">Licensed Repositories: {licenses.licensedRepos}</Typography>
          )}
          {licenses?.currentRepos != undefined && licenses?.currentRepos != null && (
            <Typography level="title-md">Current Repositories: {licenses.currentRepos}</Typography>
          )}
          {error && (
            <Typography level="title-md" color="danger">
              {error.message}
            </Typography>
          )}
        </>
      )}
    </Stack>
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
      <PageHeader title={"Setting"} corner={<TenantLicenses />} noBack={true} />
      <Sheet sx={{ display: "flex", width: "100%", minHeight: 0, flexGrow: 1 }}>
        <Grid container height="100%">
          <Grid xs={2}>
            <Box borderRight={`1px solid ${colors.grey[200]}`} pr={2} mr={2} height="100%">
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

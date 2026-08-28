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
import AgentAccess from "./AgentAccess";
import { useFetchLicenses } from "../../hooks/useFetchData";
import { fetcher } from "../../api/Fetcher";

/**
 * Which settings a backend actually has. A backend that declares nothing is the
 * classic one: it administers users and serves no MCP endpoint.
 */
const backendCapabilities = () =>
  fetcher().capabilities?.() ?? { userManagement: true, mcpTokens: false };

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
  const capabilities = backendCapabilities();
  const settingMenuItems = [
    ...(capabilities.userManagement ? [{ title: "User Management", path: "users" }] : []),
    ...(capabilities.mcpTokens ? [{ title: "Agent Access", path: "agents" }] : []),
  ];
  const landingPath = settingMenuItems[0]?.path ?? "users";

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
      <PageHeader title={"Setting"} corner={capabilities.userManagement ? <TenantLicenses /> : undefined} />
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
              {capabilities.userManagement && <Route path="users" element={<Users />} />}
              {capabilities.mcpTokens && <Route path="agents" element={<AgentAccess />} />}
              <Route path="*" element={<Navigate to={landingPath} replace={true} />} />
            </Routes>
          </Grid>
        </Grid>
      </Sheet>
    </Sheet>
  );
}

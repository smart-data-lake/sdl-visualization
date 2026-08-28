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
import AccessTokens from "./AccessTokens";
import { useFetchLicenses } from "../../hooks/useFetchData";
import { fetcher } from "../../api/Fetcher";

/**
 * Which settings a backend actually has. A backend that declares nothing is the
 * classic one: it administers users and serves no MCP endpoint.
 */
const backendCapabilities = () =>
  fetcher().capabilities?.() ?? { userManagement: true, mcpTokens: false };

/*
  Absolute paths, deliberately.

  Setting is the element of a splat route (`:tenant/settings/*`), and inside one a
  relative `to` resolves against the whole current pathname rather than against the
  route's base. So `to="agents"` reads as settings/agents from the index and
  settings/agents/agents once you are already there - and the catch-all below did
  the same, which turned one wrong path into an endless redirect: every hop appended
  another segment, remounted the page and refetched. `pathnameBase` is that base
  with the splat removed, so it stays put wherever we are underneath it.
*/
const NavLink = ({ base, to, title }) => {
  const path = `${base}/${to}`;
  const activated = useMatch(path);

  return (
    <ListItemButton selected={!!activated}>
      <Link to={path}>{title}</Link>
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
  // Always matches - this component is that route's element. See NavLink above.
  const base = useMatch(":tenant/settings/*")?.pathnameBase ?? "";
  const capabilities = backendCapabilities();
  const settingMenuItems = [
    ...(capabilities.userManagement ? [{ title: "User Management", path: "users" }] : []),
    ...(capabilities.mcpTokens ? [{ title: "Access Token", path: "tokens" }] : []),
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
                    <NavLink base={base} to={x.path} title={x.title}></NavLink>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Grid>
          <Grid xs={10}>
            <Routes>
              {capabilities.userManagement && <Route path="users" element={<Users />} />}
              {capabilities.mcpTokens && <Route path="tokens" element={<AccessTokens />} />}
              <Route path="*" element={<Navigate to={`${base}/${landingPath}`} replace={true} />} />
            </Routes>
          </Grid>
        </Grid>
      </Sheet>
    </Sheet>
  );
}

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import {
  Box,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  Sheet,
  Stack,
  Tooltip,
  Typography,
  colors,
} from "@mui/joy";
import PageHeader from "../../layouts/PageHeader";
import { Link, Navigate, Route, Routes, useLocation, useMatch } from "react-router-dom";
import Users from "./Users";
import AccessTokens from "./AccessTokens";
import Indexes from "./Indexes";
import { useFetchLicenses, useFetchMe } from "../../hooks/useFetchData";
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
  // the scope query (see goToSetting) is for every page, not only the first one
  const { search } = useLocation();

  return (
    // the whole button is the link, not only its text
    <ListItemButton component={Link} to={`${path}${search}`} selected={!!activated}>
      {title}
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

/** The page title, marked when the user is in the admin group - what decides the admin functions offered here. */
const SettingTitle = () => {
  const { data: me } = useFetchMe();
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography level="h4">Setting</Typography>
      {me?.admin && (
        <Tooltip title={`${me.email} is a member of the admin group`} variant="solid" size="sm">
          <Chip size="sm" variant="soft" color="primary" startDecorator={<AdminPanelSettingsIcon fontSize="small" />}>
            Admin
          </Chip>
        </Tooltip>
      )}
    </Stack>
  );
};

export default function Setting() {
  // Always matches - this component is that route's element. See NavLink above.
  const base = useMatch(":tenant/settings/*")?.pathnameBase ?? "";
  // The scope rides in the query string (see goToSetting); this redirect has to carry
  // it, or it is dropped one hop before the page that wants it.
  const { search } = useLocation();
  const capabilities = backendCapabilities();
  const settingMenuItems = [
    ...(capabilities.userManagement ? [{ title: "User Management", path: "users" }] : []),
    ...(capabilities.mcpTokens ? [{ title: "Access Token", path: "tokens" }] : []),
    ...(capabilities.indexes ? [{ title: "Indexes", path: "indexes" }] : []),
  ];
  const landingPath = settingMenuItems[0]?.path ?? "users";

  return (
    // Bounded to the viewport, so only the content column below scrolls and never the whole page.
    <Sheet sx={{ display: "flex", width: "100%", height: "100%", minHeight: 0, p: "0.1rem 1rem", flexDirection: "column" }}>
      <PageHeader title={<SettingTitle />} corner={capabilities.userManagement ? <TenantLicenses /> : undefined} />
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <Box sx={{ flex: "0 0 16.67%", borderRight: `1px solid ${colors.grey[200]}`, pr: 2, mr: 2, overflowY: "auto" }}>
          <List>
            {settingMenuItems.map((x) => (
              <ListItem key={x.path}>
                <NavLink base={base} to={x.path} title={x.title}></NavLink>
              </ListItem>
            ))}
          </List>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <Routes>
            {capabilities.userManagement && <Route path="users" element={<Users />} />}
            {capabilities.mcpTokens && <Route path="tokens" element={<AccessTokens />} />}
            {capabilities.indexes && <Route path="indexes" element={<Indexes />} />}
            <Route path="*" element={<Navigate to={`${base}/${landingPath}${search}`} replace={true} />} />
          </Routes>
        </Box>
      </Box>
    </Sheet>
  );
}

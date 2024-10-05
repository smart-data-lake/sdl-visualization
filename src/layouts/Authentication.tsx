import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, CircularProgress, Dropdown, IconButton, Menu, MenuButton, MenuItem, Tooltip, Typography } from "@mui/joy";
import { SxProps } from "@mui/material";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useUser } from "../hooks/useUser";
import { useWorkspace } from "../hooks/useWorkspace";

function getEmptyWorkspaceWarning() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", maxWidth: 320, p: 1, }}>
      <span>
        To upload state files, configs and metadata of data object, use the CLI interface of the SDLB.
        <br />
        See also <a href="https://github.com/smart-data-lake/sdl-visualization">SDLB UI Readme</a>
      </span>
    </Box>
  );
}

function WorkspaceSelector({selectedItem, data, setData, typographyStyle, isLoading, tooltipText}: {
  selectedItem: any;
  data: any[] | undefined;
  setData: (x: any) => void;
  typographyStyle?: SxProps | undefined;
  isLoading?: boolean;
  tooltipText?: string;
}) {
  const url = useLocation().pathname;
  const navigate = useNavigate();

  function handleNavigation() {
    const targetURL = url.split("/").splice(1)[0];
    navigate(targetURL);
  }

  return (
    <Dropdown>
      <MenuButton sx={{ display: "flex" }} slots={{ root: Box }}>
        {!data || isLoading ? (
          <CircularProgress size="sm" variant="solid" />
        ) : (
          <Tooltip arrow disableInteractive variant="soft" placement="left" title={!selectedItem ? getEmptyWorkspaceWarning() : tooltipText}
                   enterDelay={!selectedItem ? 100 : 1000} sx={{ zIndex: 10000 }}>
            <Typography sx={typographyStyle}>{selectedItem ?? "None"}</Typography>
          </Tooltip>
        )}
      </MenuButton>

      {data && data.length > 0 && !isLoading && (
        <Menu sx={{ padding: 2 }} size="sm">
          {data.map((x) => (
            <MenuItem
              key={x}
              onClick={() => {
                setData(x);
                handleNavigation();
              }}
            >
              {x}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Dropdown>
  );
}

function TenantSelector() {
  const { tenant, setTenant } = useWorkspace();
  const { data: tenants = [], isFetching: isLoading } = useFetchTenants();

  return (
    <WorkspaceSelector
      selectedItem={tenant}
      data={tenants}
      setData={setTenant}
      typographyStyle={{ color: "white", cursor: "pointer" }}
      isLoading={isLoading}
      tooltipText="Change tenant"
    />
  );
}

function RepoSelector() {
  const { tenant, repo, setRepo } = useWorkspace();
  const { isFetching: isFetchingTenants } = useFetchTenants();
  const { data: repos = [], isFetching: isFetchingRepos } = useFetchRepos(tenant);

  useEffect(() => {
    if (repos && !repos.includes(repo)) {
      setRepo(repos[0]);
    }
  }, [repos]);

  return (
    <WorkspaceSelector
      selectedItem={repo}
      data={repos}
      setData={setRepo}
      typographyStyle={{ color: "white", cursor: "pointer" }}
      isLoading={isFetchingTenants || isFetchingRepos}
      tooltipText="Choose repository"
    />
  );
}

function EnvSelector() {
  const { tenant, repo, env, setEnv } = useWorkspace();
  const { isFetching: isFetchingTenants } = useFetchTenants();
  const { isFetching: isFetchingRepos } = useFetchRepos(tenant);
  const { data: envs = [], isFetching: isFetchingEnvs } = useFetchEnvs(tenant, repo);

  useEffect(() => {
    if (envs && !envs.includes(env)) {
      setEnv(envs[0]);
    }
  }, [envs]);

  return (
    <WorkspaceSelector
      selectedItem={env}
      data={envs}
      setData={setEnv}
      typographyStyle={{ color: "white", cursor: "pointer" }}
      isLoading={isFetchingTenants || isFetchingRepos || isFetchingEnvs}
      tooltipText="Choose environment"
    />
  );
}

export default function Authentication() {
  const userContext = useUser();
  const navigate = useNavigate();

  const logout = () => {
    userContext!.signOut!();
  };

  const goToSetting = () => {
    navigate("settings/users");
  };

  return (
    <>
      <Box sx={{display: "flex", alignContent: "flex-end", flexDirection: "row", gap: 1}}>
        <TenantSelector /> /
        <RepoSelector /> /
        <EnvSelector />
      </Box>
      <Box sx={{marginBottom: "-4px"}}>
        <Dropdown>

          <MenuButton slots={{ root: IconButton }} slotProps={{ root: { variant: 'solid', color: 'primary' }}} sx={{display: "flex", borderRadius: '50%'}}>
            <SettingsIcon sx={{ height: "25px", color: "white", cursor: "pointer"}} />
          </MenuButton>

          <Menu sx={{ padding: 2 }} size="sm">
            <Typography fontSize="inherit" sx={{ marginBottom: 2 }}>
              {userContext?.email}
            </Typography>
            <MenuItem onClick={logout}>
              <Box display="flex" width={1} alignItems="center" justifyContent="space-between">
                Logout
                <LogoutIcon sx={{ cursor: "pointer", ml: 1 }} />
              </Box>
            </MenuItem>
            <MenuItem onClick={goToSetting}>
              <Box display="flex" width={1} alignItems="center" justifyContent="start">
                User Management
              </Box>
            </MenuItem>
          </Menu>
        </Dropdown>
      </Box>
    </>
  );
}

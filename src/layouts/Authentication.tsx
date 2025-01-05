import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, CircularProgress, Dropdown, IconButton, Menu, MenuButton, MenuItem, Tooltip, Typography } from "@mui/joy";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useUser } from "../hooks/useUser";
import { useWorkspace } from "../hooks/useWorkspace";

function WorkspaceSelector({selectedItem, data, setData, isLoading, tooltipText}: {
  selectedItem: any;
  data: string[];
  setData: (x: any) => void;
  isLoading?: boolean;
  tooltipText?: string;
}) {
  return (
        isLoading ? <CircularProgress size="sm" variant="solid" /> : (
          data.length == 0 ? (
            <Typography sx={{color: "white"}}>None</Typography>
          ) : (
            <Dropdown>
              <MenuButton slots={{ root: Box }}>
                <Tooltip arrow disableInteractive variant="soft" placement="left" title={tooltipText}
                        enterDelay={!selectedItem ? 100 : 1000} sx={{ zIndex: 10000 }}>
                  <Typography sx={{color: "white", cursor: "pointer"}}>{selectedItem ?? "None"}</Typography>
                </Tooltip>
              </MenuButton>
              {data.length > 0 && (
              <Menu sx={{ padding: 2 }} size="sm">
                {data.map((x) => (
                  <MenuItem key={x} onClick={() => setData(x)}>{x}</MenuItem>
                ))}
              </Menu>
              )}
            </Dropdown>
          )
        )
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
      isLoading={isLoading}
      tooltipText="Change tenant"
    />
  );
}

function RepoSelector() {
  const { tenant, repo, setRepo } = useWorkspace();
  const { data: repos = [], isFetching: isFetchingRepos } = useFetchRepos(tenant!);

  useEffect(() => {
    if (tenant && !isFetchingRepos && !repos.includes(repo)) {
      if (repos) setRepo(repos[0]);
      else setRepo();
    }
  }, [tenant, repos]);

  return (
    <WorkspaceSelector
      selectedItem={repo}
      data={repos}
      setData={setRepo}
      isLoading={!tenant || isFetchingRepos}
      tooltipText="Choose repository"
    />
  );
}

function EnvSelector() {
  const { tenant, repo, env, setEnv } = useWorkspace();
  const { data: repos = [], isFetching: isFetchingRepos } = useFetchRepos(tenant!);
  const { data: envs = [], isFetching: isFetchingEnvs } = useFetchEnvs(tenant!, repo);

  useEffect(() => {
    if (!isFetchingRepos && repos.includes(repo) && !isFetchingEnvs && !envs.includes(env)) {
      if (envs) setEnv(envs[0]);
      else setEnv();
    }
  }, [repo, repos, envs]);

  return (
    <WorkspaceSelector
      selectedItem={env}
      data={envs}
      setData={setEnv}
      isLoading={!tenant || isFetchingEnvs}
      tooltipText="Choose environment"
    />
  );
}

export default function Authentication() {
  const userContext = useUser();
  const navigate = useNavigate();
  const {tenant} = useWorkspace();

  const logout = () => {
    userContext!.signOut!();
  };

  const goToSetting = () => {
    navigate(`/${tenant}/settings/users`);
  };

  return (
    <>
      {tenant && 
        <Box sx={{display: "flex", alignContent: "flex-end", flexDirection: "row", gap: 1}}>
          <TenantSelector /> /
          <RepoSelector /> /
          <EnvSelector />
        </Box>
      }
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

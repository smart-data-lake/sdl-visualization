import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, CircularProgress, Dropdown, IconButton, Menu, MenuButton, MenuItem, Tooltip, Typography } from "@mui/joy";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useUser } from "../hooks/useUser";
import { useWorkspace, type WorkspaceSection } from "../hooks/useWorkspace";

/**
 * Which repository the URL should name. At a bare tenant this *enters* the workspace -
 * the only way anyone reaches their data - and under /content it self-corrects a repo
 * that has gone. On /settings it must do neither, which is what used to bounce those
 * pages off the screen. Undefined means "leave the URL alone".
 */
export function nextRepo(
  section: WorkspaceSection,
  repos: string[],
  repo: string | undefined,
): { repo: string | undefined } | undefined {
  if (section === "settings") return undefined;
  if (repos.includes(repo!)) return undefined;
  // repos[0] is undefined for an empty list, which setRepo reads as "back to the tenant".
  return { repo: repos[0] };
}

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
                  <Typography sx={{color: "white", cursor: "pointer"}} noWrap={true}>{selectedItem ?? "None"}</Typography>
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
  const { section, tenant, repo, setRepo } = useWorkspace();
  const { data: repos = [], isFetching: isFetchingRepos } = useFetchRepos(tenant!);

  useEffect(() => {
    if (!tenant || isFetchingRepos) return;
    const next = nextRepo(section, repos, repo);
    if (next) setRepo(next.repo);
  }, [section, tenant, repos]);

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
  const { section, tenant, repo, env, setEnv } = useWorkspace();
  const { data: repos = [], isFetching: isFetchingRepos } = useFetchRepos(tenant!);
  const { data: envs = [], isFetching: isFetchingEnvs } = useFetchEnvs(tenant!, repo);

  // The settings guard is belt-and-braces here: this effect already cannot fire there,
  // because a settings URL names no repo and so never passes repos.includes(repo).
  useEffect(() => {
    if (section === "settings" || isFetchingRepos || isFetchingEnvs) return;
    if (!repos.includes(repo!) || envs.includes(env!)) return;
    setEnv(envs[0]);
  }, [section, repo, repos, envs]);

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
  const {workspaceEnabled, tenant, repo, env} = useWorkspace();

  const logout = () => {
    userContext!.signOut!();
  };

  const goToSetting = () => {
    // "/" resolves to the configured tenant, so this stays sane in the moment before
    // the tenant is known - see RootLayoutSpinner.
    if (!tenant) return navigate("/");
    // The settings URL names no repository, so the scope travels as a query for the
    // access token page. The landing page is left to capabilities - `users` asked for
    // one the bundled backend does not have.
    const scope = repo && env ? `?${new URLSearchParams({ repo, env })}` : "";
    navigate(`/${tenant}/settings${scope}`);
  };

  return (
    <>
      {workspaceEnabled && 
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
                Settings
              </Box>
            </MenuItem>
          </Menu>
        </Dropdown>
      </Box>
    </>
  );
}

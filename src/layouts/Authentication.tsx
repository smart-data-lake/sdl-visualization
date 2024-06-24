import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import { Box, CircularProgress, Dropdown, IconButton, Menu, MenuButton, MenuItem, Tooltip, Typography } from "@mui/joy";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import LoginIcon from "@mui/icons-material/Login";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { SxProps } from "@mui/material";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";

function WorkspaceSelector({
  selectedItem,
  data,
  setData,
  typographyStyle,
  isLoading,
}: {
  selectedItem: any;
  data: any[] | undefined;
  setData: (x: any) => void;
  typographyStyle?: SxProps | undefined;
  isLoading?: boolean;
}) {
  const url = useLocation().pathname;
  const navigate = useNavigate();

  function handleNavigation() {
    const targetURL = url.split("/").splice(1)[0];
    navigate(targetURL);
  }

  return (
    <Dropdown>
      <MenuButton
        sx={{ display: "flex" }}
        slots={{
          root: Box,
        }}
      >
        {!data || isLoading ? (
          <CircularProgress size="sm" variant="solid" />
        ) : (
          <Typography sx={typographyStyle}>{selectedItem}</Typography>
        )}
      </MenuButton>

      {data && !isLoading ? (
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
      ) : null}
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
      typographyStyle={{ color: "white", cursor: "pointer", fontWeight: 600, fontSize: "1.125rem" }}
      isLoading={isLoading}
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
    />
  );
}

export default function Authentication() {
  const { user, signOut, authStatus } = useAuthenticator();
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();
  const prevAuthStatus = useRef<any>();

  useEffect(() => {
    if (
      authStatus !== prevAuthStatus.current &&
      [authStatus, prevAuthStatus.current].every((x) => ["authenticated", "unauthenticated"].includes(x))
    ) {
      navigate(0);
    }
    prevAuthStatus.current = authStatus;
  }, [authStatus]);

  const logout = () => {
    setShowLogin(false);
    signOut();
  };

  const goToSetting = () => {
    navigate("settings/users");
  };

  return (
    <>
      {(user || showLogin) && (
        <Authenticator
          variation="modal"
          components={{
            Header: () => (
              <Box position="relative">
                <IconButton
                  variant="soft"
                  size="sm"
                  sx={{
                    backgroundColor: "white",
                    mr: -4,
                    borderRadius: "50%",
                    position: "absolute",
                    right: 12,
                    top: -18,
                    minWidth: "1.25rem",
                    minHeight: "1.25rem",
                  }}
                  onClick={() => setShowLogin(false)}
                >
                  <CloseIcon sx={{ fontSize: "12pt" }} />
                </IconButton>
              </Box>
            ),
          }}
        >
          {() => (
            <>
              <Box
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <TenantSelector />
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  right: "0",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pr: 2,
                }}
              >
                <RepoSelector /> /
                <EnvSelector />
                <Dropdown>
                  <MenuButton
                    sx={{ display: "flex" }}
                    slots={{
                      root: Box,
                    }}
                  >
                    <SettingsIcon sx={{ color: "white", cursor: "pointer", ml: 1, fontSize: "1.25em" }} />
                  </MenuButton>

                  <Menu sx={{ padding: 2 }} size="sm">
                    <Typography fontSize="inherit" sx={{ marginBottom: 2 }}>
                      {user?.attributes?.email}
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
          )}
        </Authenticator>
      )}
      {!user && (
        <Box
          sx={{
            position: "absolute",
            right: "0",
            display: "flex",
            alignItems: "center",
            gap: 1,
            pr: 2,
          }}
        >
          <Tooltip title="Sign in">
            <LoginIcon
              sx={{ color: "white", cursor: "pointer", ml: 2, fontSize: "1.25em" }}
              onClick={() => setShowLogin(true)}
            />
          </Tooltip>
        </Box>
      )}
    </>
  );
}

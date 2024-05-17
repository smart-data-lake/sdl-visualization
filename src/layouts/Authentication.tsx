import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import {
  Box,
  Dropdown,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/joy";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import LoginIcon from "@mui/icons-material/Login";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../hooks/TenantProvider";
import { useFetchTenants } from "../hooks/useFetchData";

function TenantSelector() {
  const { tenant, setTenant } = useTenant();
  const { data: tenants = [] } = useFetchTenants();

  return (
    <Dropdown>
      <MenuButton
        sx={{ display: "flex" }}
        slots={{
          root: Box,
        }}
      >
        <Typography
          fontSize="inherit"
          sx={{ color: "white", cursor: "pointer" }}
        >
          {tenant}
        </Typography>
      </MenuButton>

      <Menu sx={{ padding: 2 }} size="sm">
        {tenants.map((x) => (
          <MenuItem onClick={() => setTenant(x)}>{x}</MenuItem>
        ))}
      </Menu>
    </Dropdown>
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
      [authStatus, prevAuthStatus.current].every((x) =>
        ["authenticated", "unauthenticated"].includes(x)
      )
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
              <TenantSelector />
              <Dropdown>
                <MenuButton
                  sx={{ display: "flex" }}
                  slots={{
                    root: Box,
                  }}
                >
                  <SettingsIcon
                    sx={{ color: "white", cursor: "pointer", ml: 2 }}
                  />
                </MenuButton>

                <Menu sx={{ padding: 2 }} size="sm">
                  <Typography fontSize="inherit" sx={{ marginBottom: 2 }}>
                    {user?.attributes?.email}
                  </Typography>
                  <MenuItem onClick={logout}>
                    <Box
                      display="flex"
                      width={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      Logout
                      <LogoutIcon sx={{ cursor: "pointer", ml: 1 }} />
                    </Box>
                  </MenuItem>
                  <MenuItem onClick={goToSetting}>
                    <Box
                      display="flex"
                      width={1}
                      alignItems="center"
                      justifyContent="start"
                    >
                      User Management
                    </Box>
                  </MenuItem>
                </Menu>
              </Dropdown>
            </>
          )}
        </Authenticator>
      )}
      {!user && (
        <Tooltip title="Sign in">
          <LoginIcon
            sx={{ color: "white", cursor: "pointer", ml: 2 }}
            onClick={() => setShowLogin(true)}
          />
        </Tooltip>
      )}
    </>
  );
}

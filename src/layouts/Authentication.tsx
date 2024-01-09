import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import { Box, IconButton, Tooltip, Typography } from "@mui/joy";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import LoginIcon from "@mui/icons-material/Login";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
              <Typography fontSize="inherit" sx={{ color: "white" }}>
                {user?.attributes?.email}
              </Typography>
              <Tooltip title="Sign out">
                <LogoutIcon
                  sx={{ color: "white", cursor: "pointer", ml: 2 }}
                  onClick={() => logout()}
                />
              </Tooltip>
              <Tooltip title="Settings">
                <SettingsIcon
                  sx={{ color: "white", cursor: "pointer", ml: 2 }}
                  onClick={() => goToSetting()}
                />
              </Tooltip>
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

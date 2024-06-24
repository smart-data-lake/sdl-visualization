import { Box, CircularProgress } from "@mui/joy";
import { useWorkspace } from "../hooks/useWorkspace";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useAuthenticator } from "@aws-amplify/ui-react";

function Spinner() {
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

function WorkspaceSpinner({ children }) {
  const { user } = useAuthenticator();
  const { tenant, repo, env } = useWorkspace();
  const { isFetching: isFetchingTenants } = useFetchTenants();
  const { isFetching: isFetchingRepos } = useFetchRepos(tenant);
  const { isFetching: isFetchingEnvs } = useFetchEnvs(tenant, repo);

  const workspaceAvailable = !!tenant && !!repo && !!env;
  const isLoading = isFetchingTenants || isFetchingRepos || isFetchingEnvs;
  const displaySpinner = user && (!workspaceAvailable || isLoading);

  if (displaySpinner) {
    return <Spinner />;
  }

  return <>{children}</>;
}

function RootLayoutSpinner({ children }) {
  const { data: manifest, isFetching: isLoadingManifest } = useManifest();

  if (isLoadingManifest) {
    return <Spinner />;
  }

  if (!manifest?.auth) {
    return <>{children}</>;
  }

  return <WorkspaceSpinner>{children}</WorkspaceSpinner>;
}

export default RootLayoutSpinner;

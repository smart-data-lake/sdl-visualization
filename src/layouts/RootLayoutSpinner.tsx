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
  const { data: repos, isFetching: isFetchingRepos } = useFetchRepos(tenant);
  const { data: envs, isFetching: isFetchingEnvs } = useFetchEnvs(tenant, repo);

  const isLoadingTenants = isFetchingTenants;
  // There is a case where list of repos is already fetched but a default repo is not selected yet
  const isLoadingRepos = isFetchingRepos || (!repo && !!repos);
  // Same logic here with default env not selected yet
  const isLoadingEnvs = isFetchingEnvs || (!env && !!envs);

  const isLoading = isLoadingTenants || isLoadingRepos || isLoadingEnvs;
  const displaySpinner = user && (isLoading);

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

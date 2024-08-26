import { useAuthenticator } from "@aws-amplify/ui-react";
import CenteredCircularProgress from "../components/Common/CenteredCircularProgress";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useWorkspace } from "../hooks/useWorkspace";

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
    return <CenteredCircularProgress />;
  }

  return <>{children}</>;
}

function RootLayoutSpinner({ children }) {
  const { data: manifest, isFetching: isLoadingManifest } = useManifest();

  if (isLoadingManifest) {
    return <CenteredCircularProgress />;
  }

  if (!manifest?.auth) {
    return <>{children}</>;
  }

  return <WorkspaceSpinner>{children}</WorkspaceSpinner>;
}

export default RootLayoutSpinner;

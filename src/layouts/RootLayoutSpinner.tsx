import { useAuthenticator } from "@aws-amplify/ui-react";
import CenteredCircularProgress from "../components/Common/CenteredCircularProgress";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useWorkspace } from "../hooks/useWorkspace";

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

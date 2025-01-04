import { useAuthenticator } from "@aws-amplify/ui-react";
import CenteredCircularProgress from "../components/Common/CenteredCircularProgress";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useWorkspace } from "../hooks/useWorkspace";
import PageHeader from "./PageHeader";
import { useLocation } from "react-router-dom";
import { Box } from "@mui/joy";


function WorkspaceSpinner({ children }) {
  const { user } = useAuthenticator();
  const { tenant, repo, env } = useWorkspace();
  const { isFetching: isFetchingTenants } = useFetchTenants();
  const { data: repos, isFetching: isFetchingRepos } = useFetchRepos(tenant);
  const { data: envs, isFetching: isFetchingEnvs } = useFetchEnvs(tenant, repo);
  const location = useLocation();

  const isLoading = isFetchingTenants || isFetchingRepos || isFetchingEnvs;
  const isSettings = location.pathname.startsWith("/settings");

  if ( user && !isLoading && (!repos || !envs)) {
    if (!isSettings) {
      return <>
        <PageHeader title="Welcome to SDLB UI" noBack={true} />
        <Box sx={{ display: "flex", flexDirection: "column", p: 1, }}>
          <span>
          This Workspace is still empty.
          <br/>
          Use the following steps to upload an SDLB configuration and SDLB run states.
          <ol>
            <li>configure global.uiBackend TODO</li>
            <li>export configuration using TODO</li>
            <li>run SDLB</li>
          </ol>
          </span>
        </Box>
      </>;
    } else {
      return <>{children}</>;
    }
  }

  if ( user && (isLoading || !repo || !env)) {
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

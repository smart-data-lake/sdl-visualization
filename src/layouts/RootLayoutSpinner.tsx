import { Box } from "@mui/joy";
import CenteredCircularProgress from "../components/Common/CenteredCircularProgress";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useWorkspace } from "../hooks/useWorkspace";
import PageHeader from "./PageHeader";


function WorkspaceSpinner({ children }) {
  const { tenant, repo, env } = useWorkspace();
  const { isFetching: isFetchingTenants } = useFetchTenants();
  const { isFetching: isFetchingRepos } = (useFetchRepos(tenant!));
  const { isFetching: isFetchingEnvs } = useFetchEnvs(tenant!, repo);

  const isLoading = isFetchingTenants || isFetchingRepos || isFetchingEnvs;

  if (isLoading) {
    return <CenteredCircularProgress />;
  }

  return <>{children}</>;
}

export function WorkspaceEmpty() {
  const { tenant } = useWorkspace();
  return <>
    <PageHeader title="Welcome to SDLB UI" noBack={true} />
    <Box sx={{ display: "flex", flexDirection: "column", p: 1, }}>
      <span>
      Tenant '{tenant}' seems still empty.<br/>
      Select another tenant in the upper right corner,<br/>
      or use the following steps to upload an SDLB configuration and SDLB run states:
      <ol>
        <li>configure global.uiBackend TODO</li>
        <li>export configuration using TODO</li>
        <li>run SDLB</li>
      </ol>
      </span>
    </Box>
  </>;
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

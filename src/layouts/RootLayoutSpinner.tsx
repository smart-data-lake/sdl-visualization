import { Box } from "@mui/joy";
import CenteredCircularProgress from "../components/Common/CenteredCircularProgress";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useWorkspace } from "../hooks/useWorkspace";
import PageHeader from "./PageHeader";
import MarkdownComponent from "../components/ConfigExplorer/MarkdownComponent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


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
  const manifest = useManifest();
  const url = manifest.data?.backendConfig.split(";")[1];
  const clientId = manifest.data?.auth["aws_user_pools_web_client_id"];
  
  const markdown = `
**Tenant '${tenant}' seems still empty.**

Use the following steps based on our [getting-started](https://github.com/smart-data-lake/getting-started) guide to upload an SDLB configuration and runtime informations,  
or select another tenant in the upper right corner.

#### 1. Add global.uiBackend configuration
Adapt _repo_ (repository name) and _env_ (environment name) to your needs and use [Secret Providers](https://smartdatalake.ch/docs/reference/hoconSecrets) to hide the _password_ of your UI user.

    global {
      
      ...

      uiBackend {
        baseUrl = "${url}"
        tenant = ${tenant}
        repo = getting-started
        env = dev
        authMode {
          type = AWSUserPwdAuthMode
          region = eu-central-1
          userPool = sdlb-ui
          clientId = ${clientId}
          useIdToken = true
          user = "###ENV#user###"
          password = "###ENV#pwd###"
        }
      }
    }

#### 2. Export SDLB configuration to the UI
Use the _exportConfigSchemaStats.sh_  script from the [getting-started](https://github.com/smart-data-lake/getting-started) folder to export the SDLB configuration to the UI.  
This will initialize and populate the _repository_ and _environment_ in the UI, so it is no longer empty.

#### 3. Run SDLB Job
Use the _startJob.sh_ script from the [getting-started](https://github.com/smart-data-lake/getting-started) folder to run an SDLB Job.  
The SDLB Job will automatically pickup the global.uiBackend configuration and push its runtime information to the UI.

`


  return <>
    <PageHeader title="Welcome to SDLB UI"/>
    <Box sx={{ display: "flex", flexDirection: "column", p: 2, backgroundColor: "white", overflow: "auto" }}>
      <ReactMarkdown className='markdown-body' children={markdown} remarkPlugins={[remarkGfm]} />
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

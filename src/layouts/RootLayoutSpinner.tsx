import { Box, Button, Typography } from "@mui/joy";
import { Navigate, useNavigate } from "react-router-dom";
import CenteredCircularProgress from "../components/Common/CenteredCircularProgress";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "../hooks/useFetchData";
import { useManifest } from "../hooks/useManifest";
import { useWorkspace } from "../hooks/useWorkspace";
import PageHeader from "./PageHeader";
import MarkdownComponent from "../components/ConfigExplorer/MarkdownComponent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


/**
 * The gate every page passes through, and where the tenant is settled.
 *
 * This sits around the Outlet, so it covers /xyz, /xyz/content/... and /xyz/settings/...
 * alike - one check before any page mounts, rather than one per route element. It is
 * also the first place below AuthProvider that can ask: useFetchTenants is disabled
 * until authenticated, so useWorkspace (which is mounted above AuthProvider) cannot.
 */
function WorkspaceSpinner({ children }) {
  const { tenant, repo, env } = useWorkspace();
  const { data: tenants, isFetching: isFetchingTenants } = useFetchTenants();
  const { isFetching: isFetchingRepos } = (useFetchRepos(tenant!));
  const { isFetching: isFetchingEnvs } = useFetchEnvs(tenant!, repo);

  const isLoading = isFetchingTenants || isFetchingRepos || isFetchingEnvs;

  if (isLoading) {
    return <CenteredCircularProgress />;
  }

  /*
    Only decide once there is something to decide with. An empty list is not "no such
    tenant" - it is either nobody signed in yet (useFetchTenants is disabled until then,
    so it never runs and never fetches) or a failed read (retry is off). Getting this
    wrong puts "Tenant does not exist" over the login screen, which locks everyone out.

    A name is filtered out if it is empty, because redirecting to "/" would loop here.
  */
  const known = (Array.isArray(tenants) ? tenants : []).filter(Boolean);
  if (known.length > 0) {
    // No tenant in the URL: adopt the one this deployment serves. This is what replaces
    // the SPA's old hard-coded default - the name now comes from GET /tenants, which is
    // the tenant_name of the deployment.
    if (!tenant) return <Navigate to={`/${known[0]}`} replace />;
    if (!known.includes(tenant)) return <TenantNotFound tenant={tenant} />;
  }

  return <>{children}</>;
}

/**
 * A tenant the deployment does not have.
 *
 * Distinct from WorkspaceEmpty on purpose: that one means "this tenant exists and has
 * no data yet" and offers the upload guide, which is useless and misleading advice for
 * a name that is simply wrong.
 */
export function TenantNotFound({ tenant }: { tenant: string }) {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Unknown tenant" />
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, p: 2 }}>
        <Typography level="body-lg">Tenant "{tenant}" does not exist.</Typography>
        {/* "/" is resolved above, so home is defined in one place rather than two. */}
        <Button variant="soft" onClick={() => navigate("/")}>
          Go to home
        </Button>
      </Box>
    </>
  );
}

export function WorkspaceEmpty() {
  const { tenant } = useWorkspace();
  const manifest = useManifest();
  const url = manifest.data?.backendConfig.split(";")[1];
  const clientId = manifest.data?.auth?.["aws_user_pools_web_client_id"];

  // Which authMode the user should configure depends on which backend they are
  // uploading to: the hosted one authenticates against its Cognito pool, the Azure
  // one takes any bearer token and verifies it against the Databricks workspace.
  const authModeSnippet =
    manifest.data?.auth?.type === "databricks"
      ? `        authMode {
          type = TokenAuthMode
          token = "###ENV#SDLB_UI_TOKEN###"
        }`
      : `        authMode {
          type = AWSUserPwdAuthMode
          region = eu-central-1
          userPool = sdlb-ui
          clientId = ${clientId}
          useIdToken = true
          user = "###ENV#user###"
          password = "###ENV#pwd###"
        }`;

  // `tenant` is undefined only when the backend reported no tenants at all - a fresh
  // deployment. Naming one then would print "Tenant 'undefined'".
  const heading = tenant
    ? `**Tenant '${tenant}' seems still empty.**`
    : "**This deployment seems still empty.**";

  const markdown = `
${heading}

Use the following steps based on our [getting-started](https://github.com/smart-data-lake/getting-started) guide to upload an SDLB configuration and runtime informations,  
or select another tenant in the upper right corner.

#### 1. Add global.uiBackend configuration
Adapt _repo_ (repository name) and _env_ (environment name) to your needs and use [Secret Providers](https://smartdatalake.ch/docs/reference/hoconSecrets) to hide the credentials.

    global {
      
      ...

      uiBackend {
        baseUrl = "${url}"
        tenant = ${tenant ?? "<your tenant>"}
        repo = getting-started
        env = dev
${authModeSnippet}
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

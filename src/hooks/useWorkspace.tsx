import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useManifest } from "./useManifest";

type WorkspaceContextType = {
  tenant: string | undefined; // if tenant is undefined, UI Backend is not configured.
  setTenant: (tenant: string) => void;
  repo: string | undefined;
  setRepo: (repo?: string) => void;
  env: string | undefined;
  setEnv: (env?: string) => void;
  contentPath: string | undefined;
  contentSubPath: string | undefined;
  navigateContent: (contentPath: string) => void;
  navigateRel: (relPath: string) => void;
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(undefined);
WorkspaceContext.displayName = "WorkspaceContext";

const WorkspaceProvider = (props: React.PropsWithChildren) => {
  const {data: manifest} = useManifest();
  const location = useLocation(); // state is managed through url parameters...  
  const [urlTenant, content, urlRepo, urlEnv, ...contentSubPathElements] = (manifest?.auth ? [] as string[] : [undefined, undefined, undefined, undefined]).concat(location.pathname.split('/').filter(v => v.length>0))
  const repo = (content == "content" ? urlRepo : undefined)  
  const env = (content == "content" ? urlEnv : undefined)  
  const tenant = (manifest?.auth ? (urlTenant || "PrivateTenant") : undefined);
  const contentPath = (!tenant ? "/": (repo && env ? `/${tenant}/content/${repo}/${env}/` : undefined));
  const contentSubPath = (!tenant || contentPath ? contentSubPathElements.join("/") : undefined);
  const navigate = useNavigate();

  /*
    Every path below is absolute, and the leading slash is the whole point.

    These name a place in the workspace - a tenant, a repository, an environment -
    rather than a step from wherever we happen to be, and react-router treats a path
    without a leading slash as relative to the current one. `navigate(tenant)` from
    /PrivateTenant therefore goes to /PrivateTenant/PrivateTenant, and again on the
    next click: the home button used to walk down its own path one segment at a time.
    Only navigateRel is meant to be relative, and it says so in its name.
  */
  function setTenant(newTenant: string) {
    if (env) navigate(`/${newTenant}/content/${repo}/${env}`)
    else if (repo) navigate(`/${newTenant}/content/${repo}`)
    else navigate(`/${newTenant}`)

  }
  function setRepo(newRepo: string | undefined) {
    if (newRepo) navigate(`/${tenant}/content/${newRepo}/${env}`);
    else navigate(`/${tenant}`);
  }
  function setEnv(newEnv: string | undefined) {
    if (newEnv) navigate(`/${tenant}/content/${repo}/${newEnv}`)
    else navigate(`/${tenant}/content/${repo}`);
  }
  function navigateContent(contentSubPath: string) {
    if (!contentPath) {
      if (contentSubPath!="") throw new Error("Can not navigateContent when contentPath is undefined");
      // The home button, before a repository and environment have been chosen.
      else navigate(tenant ? `/${tenant}` : "/")
    }
    else {
      navigate(contentPath + contentSubPath);
    }
  }
  function ensureTrailingSlash(path: string) {
    return (path.endsWith("/") ? path : path + "/")
  }
  function navigateRel(relPath: string) {
    navigate(ensureTrailingSlash(location.pathname) + relPath);
  }

  return (
    <WorkspaceContext.Provider
      value={{ tenant, setTenant, repo, setRepo, env, setEnv, contentPath, contentSubPath, navigateContent, navigateRel }}
    >
      {props.children}
    </WorkspaceContext.Provider>
  );
};

const useWorkspace = (): WorkspaceContextType => {
  const context = React.useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceContext");
  }
  return context;
};

export { useWorkspace, WorkspaceProvider };


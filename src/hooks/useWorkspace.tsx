import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetchEnvs, useFetchRepos, useFetchTenants } from "./useFetchData";

type WorkspaceContextType = {
  tenant: string;
  setTenant: React.Dispatch<React.SetStateAction<string>>;
  repo: string | undefined;
  setRepo: (repo: string) => void
  env: string | undefined;
  setEnv: (repo: string) => void
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(undefined);
WorkspaceContext.displayName = "WorkspaceContext";

const WorkspaceProvider = (props: React.PropsWithChildren) => {
  const [tenant, setTenant] = useState<string>("PrivateTenant");
  const [repo, setRepo] = useState<string | undefined>();
  const [env, setEnv] = useState<string | undefined>();

  return (
    <WorkspaceContext.Provider
      value={{ tenant, setTenant, repo, setRepo, env, setEnv}}
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

export { WorkspaceProvider, useWorkspace };

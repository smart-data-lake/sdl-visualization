import React, { useState } from "react";

type WorkspaceContextType = {
  tenant: string;
  setTenant: React.Dispatch<React.SetStateAction<string>>;
  repo: string;
  setRepo: React.Dispatch<React.SetStateAction<string>>;
  env: string;
  setEnv: React.Dispatch<React.SetStateAction<string>>;
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(undefined);
WorkspaceContext.displayName = "WorkspaceContext";

const WorkspaceProvider = (props: React.PropsWithChildren) => {
  const [tenant, setTenant] = useState<string>("PrivateTenant");
  const [repo, setRepo] = useState<string>("");
  const [env, setEnv] = useState<string>("");

  return (
    <WorkspaceContext.Provider
      value={{
        tenant,
        setTenant,
        repo,
        setRepo,
        env,
        setEnv,
      }}
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

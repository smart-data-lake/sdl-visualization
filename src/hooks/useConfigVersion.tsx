import React from "react";
import { useWorkspace } from "./useWorkspace";

/*
  Which configuration version the app is looking at.

  The config explorer used to keep this in local state, which the global search in the title
  bar cannot reach - it is mounted outside the config explorer's routes. Keeping it here also
  means the selected version survives a trip to the workflows explorer and back.
*/

type ConfigVersionContextType = {
  version: string | undefined;
  setVersion: (version: string | undefined) => void;
};

const ConfigVersionContext = React.createContext<ConfigVersionContextType | undefined>(undefined);

const ConfigVersionProvider = (props: React.PropsWithChildren) => {
  const { tenant, repo, env } = useWorkspace();
  const [version, setVersion] = React.useState<string | undefined>(undefined);
  const workspace = `${tenant}/${repo}/${env}`;
  const [lastWorkspace, setLastWorkspace] = React.useState(workspace);

  // a version belongs to one workspace, so switching repo or environment invalidates it
  if (lastWorkspace !== workspace) {
    setLastWorkspace(workspace);
    setVersion(undefined);
  }

  const context = React.useMemo(() => ({ version, setVersion }), [version]);
  return <ConfigVersionContext.Provider value={context}>{props.children}</ConfigVersionContext.Provider>;
};

const useConfigVersion = (): ConfigVersionContextType => {
  const context = React.useContext(ConfigVersionContext);
  if (context === undefined) {
    throw new Error("useConfigVersion must be used within a ConfigVersionProvider");
  }
  return context;
};

export { ConfigVersionProvider, useConfigVersion };

import { useMutation, useQuery } from "react-query";
import { useWorkspace } from "./useWorkspace";
import { fetcher } from "../api/Fetcher";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { TstampEntry } from "../types";

/**
 * React Query wrapper for fetching data
 **/

/**** Workflows  ****/
export const useFetchWorkflows = (enabled: boolean) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["workflows", tenant, repo, env],
    queryFn: () => fetcher().getWorkflows(tenant, repo, env),
    enabled: enabled,
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

export const useFetchWorkflowRuns = (workflow: string, enabled: boolean) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["workflow", workflow, tenant, repo, env],
    queryFn: () => fetcher().getWorkflowRuns(tenant, repo, env, workflow),
    enabled: enabled,
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

export const useFetchWorkflowRunsByElement = (elementType: string, elementName: string) => {
  var queryFn = () => Promise.resolve(undefined as any[]|undefined);
  if (elementType === "dataObjects") queryFn = () => fetcher().getWorkflowRunsByDataObject(elementName)
  if (elementType === "actions") queryFn = () => fetcher().getWorkflowRunsByAction(elementName)
  return useQuery({ queryKey: ['workflowRunByAction', elementType, elementName], queryFn: queryFn, retry: false, staleTime: 1000 * 60 * 60 * 24 }) //24h
}

export const useFetchRun = (application: string, runId: number, attemptId: number, enabled: boolean) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["run", tenant, repo, env, application, runId, attemptId],
    queryFn: () => fetcher().getRun({ tenant, repo, env, application, runId, attemptId }),
    enabled: enabled,
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

/**** Config ****/
export function useFetchConfig(version: string | undefined, enabled: boolean) {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["config", tenant, repo, env, version],
    queryFn: () => fetcher().getConfig(tenant, repo, env, version),
    enabled: enabled,
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
}

export function useFetchConfigVersions(enabled: boolean) {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["config", tenant, repo, env],
    queryFn: () => fetcher().getConfigVersions(tenant, repo, env),
    enabled: enabled,
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
}

/**** DataObject schema entries with tstamp  ****/
function getSchemaEntries(
  elementType: string | undefined,
  elementName: string | undefined,
  tenant: string,
  repo: string,
  env: string
): Promise<TstampEntry[] | undefined> {
  if (elementType != "dataObjects" || !elementType || !elementName) return Promise.resolve(undefined); // Schemas only exists for data objects
  return fetcher().getTstampEntries("schema", "schema", elementName, tenant, repo, env);
}
export const useFetchDataObjectSchemaEntries = (elementType: string | undefined, elementName: string | undefined) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["schemaEntries", elementType, elementName, tenant, repo, env],
    queryFn: () => getSchemaEntries(elementType, elementName, tenant, repo, env),
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

/**** DataObject schema data ****/
export const useFetchDataObjectSchema = (schemaEntry: TstampEntry | undefined) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["schema", schemaEntry, tenant, repo, env],
    queryFn: () => fetcher().getSchema(schemaEntry, tenant, repo, env),
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

/**** DataObject statistics entries with tstamp  ****/
function getStatsEntries(
  elementType: string | undefined,
  elementName: string | undefined,
  tenant: string,
  repo: string,
  env: string
): Promise<TstampEntry[] | undefined> {
  if (elementType != "dataObjects" || !elementType || !elementName) return Promise.resolve(undefined); // Statistics only exists for data objects
  return fetcher().getTstampEntries("schema", "stats", elementName, tenant, repo, env);
}
export const useFetchDataObjectStatsEntries = (elementType: string | undefined, elementName: string | undefined) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["statsEntries", elementType, elementName, tenant, repo, env],
    queryFn: () => getStatsEntries(elementType, elementName, tenant, repo, env),
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

/**** DataObject statistics data  ****/
export const useFetchDataObjectStats = (statsEntry: TstampEntry | undefined) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["stats", statsEntry, tenant, repo, env],
    queryFn: () => fetcher().getStats(statsEntry, tenant, repo, env),
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

/**** Element description markdown files ****/
export const useFetchDescription = (
  elementType: string | undefined,
  elementName: string | undefined,
  version: string | undefined
) => {
  const { tenant, repo, env } = useWorkspace();
  return useQuery({
    queryKey: ["description", elementType, elementName, tenant, repo, env, version],
    queryFn: () => fetcher().getDescription(elementType, elementName, tenant, repo, env, version),
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
}

export const useFetchUsers = (enabled: boolean) => {
  const { tenant } = useWorkspace();
  return useQuery({ queryKey: ["users", tenant], queryFn: () => fetcher().getUsers(tenant), enabled: enabled });
};

export const useAddUser = () => {
  const { tenant } = useWorkspace();
  return useMutation(({ email, access }: any) => fetcher().addUser(tenant, email, access));
}

export const useRemoveUser = () => {
  const { tenant } = useWorkspace();
  return useMutation(({ email }: any) => fetcher().removeUser(tenant, email));
}

export const useFetchTenants = () => {
  const { authStatus } = useAuthenticator();
  return useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetcher().getTenants(),
    enabled: authStatus === "authenticated",
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

export const useFetchRepos = (tenant: string) => {
  const { authStatus } = useAuthenticator();
  return useQuery({
    queryKey: ["repo", tenant],
    queryFn: () => fetcher().getRepos(tenant),
    retry: false,
    enabled: authStatus === "authenticated" && !!tenant,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

export const useFetchEnvs = (tenant: string, repo: string) => {
  const { authStatus } = useAuthenticator();
  return useQuery({
    queryKey: ["envs", tenant, repo],
    queryFn: () => fetcher().getEnvs(tenant, repo),
    retry: false,
    enabled: authStatus === "authenticated" && !!tenant && !!repo,
    staleTime: 1000 * 60 * 60 * 24,
  }); //24h
};

export const useFetchLicenses = () => {
  const { tenant } = useWorkspace();
  return useQuery<any, Error>({
    queryKey: ["license", tenant],
    queryFn: () => fetcher().getLicenses(tenant),
    enabled: tenant !== "PrivateTenant",
  });
};

export default useFetchWorkflows;

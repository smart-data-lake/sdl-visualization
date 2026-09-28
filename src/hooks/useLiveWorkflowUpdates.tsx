import { useEffect, useState } from "react";
import { useQueryClient } from "react-query";
import { fetcher } from "../api/Fetcher";
import type { LiveStatus } from "../api/liveUpdates";
import { useWorkspace } from "./useWorkspace";

/** Collects notifications this long before refetching, as SDLB starts a stage's actions in the same millisecond. */
const THROTTLE_MS = 1_500;

/** What the refresh button shows while connected: whether the workflow still has something running. */
export type LiveIndicator = 'running' | 'finished';

/**
 * Refetches the workflow's queries whenever the backend reports that one of its runs changed, and
 * returns what the refresh button shows - undefined while not connected, and on a backend without
 * live updates, where the refresh button stays the only way.
 */
export function useLiveWorkflowUpdates(workflow: string | undefined, enabled: boolean, running: boolean): LiveIndicator | undefined {
    const { tenant, repo, env } = useWorkspace();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<LiveStatus>();

    useEffect(() => {
        const subscribe = fetcher().subscribeWorkflowUpdates;
        if (!enabled || !workflow || !subscribe) return;

        const runs = new Set<string>();
        let all = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const flush = () => {
            timer = undefined;
            queryClient.invalidateQueries(["workflow", workflow, tenant, repo, env]);
            queryClient.invalidateQueries(["workflows", tenant, repo, env]);
            if (all) queryClient.invalidateQueries(["run", tenant, repo, env, workflow]);
            else runs.forEach(key => {
                const [runId, attemptId] = key.split('.').map(Number);
                queryClient.invalidateQueries(["run", tenant, repo, env, workflow, runId, attemptId]);
            });
            runs.clear();
            all = false;
        };

        const unsubscribe = subscribe(tenant!, repo!, env!, workflow, change => {
            if (change) runs.add(`${change.runId}.${change.attemptId}`);
            else all = true;
            if (!timer) timer = setTimeout(flush, THROTTLE_MS);
        }, setStatus);
        return () => {
            unsubscribe();
            clearTimeout(timer);
            setStatus(undefined);
        };
    }, [tenant, repo, env, workflow, enabled, queryClient]);

    if (status !== 'connected') return undefined;
    return running ? 'running' : 'finished';
}

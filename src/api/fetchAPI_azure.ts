import { getAuthHeaders } from "../auth/tokenProvider";
import { LicenseInfo, User, WorkflowRun } from "../types";
import { BackendCapabilities, McpToken } from "./fetchAPI";
import { fetchAPI_rest, processWorkflowHistory } from "./fetchAPI_rest";

/**
 * Backend implementation for the Azure deployment.
 *
 * It speaks the same REST contract as fetchAPI_rest, only three things differ:
 *
 *  - credentials come from whichever auth provider is configured, rather than from
 *    Amplify directly, and carry the Databricks workspace alongside the token;
 *  - getWorkflowRunsByAction and getWorkflowRunsByDataObject are implemented, which
 *    is what makes the "Last 5 runs" panel of the config explorer work at all;
 *  - user administration and licensing do not exist. The deployment serves one
 *    tenant whose access is decided by its Databricks workspace, so there is no
 *    directory to manage and nothing to meter. getUsers still answers, with the
 *    caller alone, because useUser cross-references it to find its own permissions.
 */
export class fetchAPI_azure extends fetchAPI_rest {
    /** Scope to fall back on when the app runs without a workspace switcher, see fetch(). */
    private readonly defaultScope: { tenant: string; repo?: string; env?: string };

    /**
     * backendConfig is "azure;<baseUrl>[;<repo>;<env>]". Naming a repo and an
     * environment pins the deployment to one of them, which is what a single
     * repository behind an external proxy wants: no login, no switcher, flat routes.
     */
    constructor(configString: string, baseUrl?: string, env?: string) {
        const [url, repo, scopeEnv] = configString.split(';');
        super(url, baseUrl, env);
        this.defaultScope = { tenant: 'PrivateTenant', repo, env: scopeEnv ?? env };
    }

    /**
     * Fill in the scope the request did not carry.
     *
     * Without auth configured, useWorkspace leaves tenant, repo and env undefined
     * and the inherited methods put "undefined" into the query string. Rewriting it
     * in one place here keeps every inherited method working, rather than
     * overriding all nineteen of them.
     */
    protected async fetch(url: string, init: Promise<RequestInit> = this.getRequestInfo()) {
        return super.fetch(this.withScope(url), init);
    }

    private withScope(url: string): string {
        const parsed = new URL(url, window.location.origin);
        const fill = (name: 'tenant' | 'repo' | 'env', fallback?: string) => {
            const value = parsed.searchParams.get(name);
            if ((value === null || value === 'undefined' || value === '') && fallback) {
                parsed.searchParams.set(name, fallback);
            }
        };
        fill('tenant', this.defaultScope.tenant);
        fill('repo', this.defaultScope.repo);
        fill('env', this.defaultScope.env);
        // Keep the original form when it was already absolute or relative as given.
        return url.startsWith('http') ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
    }

    protected async getRequestInfo(method: string = 'GET', headers?: any): Promise<RequestInit> {
        return { mode: "cors", method, headers: { ...(await getAuthHeaders()), ...headers } };
    }

    getWorkflowRunsByAction = (name: string): Promise<WorkflowRun[]> => {
        return this.runsByElement('byAction', name);
    };

    getWorkflowRunsByDataObject = (name: string): Promise<WorkflowRun[]> => {
        return this.runsByElement('byDataObject', name);
    };

    /**
     * Both lookups are one indexed query on the backend. The workspace is not a
     * parameter of the fetchAPI methods, so it is taken from the URL the same way
     * useWorkspace derives it - see the note on scopeFromPath below.
     */
    private async runsByElement(operation: string, name: string): Promise<WorkflowRun[]> {
        // fetch() fills in whatever the URL leaves out, so only what is known is set.
        const scope = currentScope() ?? this.defaultScope;
        const query = new URLSearchParams({ name });
        if (scope.tenant) query.set('tenant', scope.tenant);
        if (scope.repo) query.set('repo', scope.repo);
        if (scope.env) query.set('env', scope.env);
        return this.fetch(`${this.url}/runs/${operation}?${query}`).then(runs => processWorkflowHistory(runs));
    }

    /** The signed-in user, so that useUser has an entry to find its permissions in. */
    getUsers = async (): Promise<User[]> => {
        const me = await this.fetch(`${this.url}/me`);
        return [{ user_id: me.email, email: me.email, permissions: ['Admin'] }];
    };

    addUser = async (): Promise<void> => {
        throw new Error("This deployment has no user directory - access is granted in Databricks.");
    };

    removeUser = async (): Promise<void> => {
        throw new Error("This deployment has no user directory - access is granted in Databricks.");
    };

    getLicenses = async (): Promise<LicenseInfo> => ({});

    capabilities = (): BackendCapabilities => ({ userManagement: false, mcpTokens: true });

    /**** MCP access ****/

    /**
     * A token an agent can hold, minted against the caller's proven Databricks
     * identity. The Databricks token itself is deliberately not what goes into an
     * MCP client configuration: it expires within the hour, and it is a credential
     * for somebody else's resource.
     */
    createMcpToken = async (tenant: string, repo: string, env: string, label: string, ttlDays?: number): Promise<McpToken & { token: string }> => {
        const requestInfo = await this.getRequestInfo("POST", { "Content-Type": "application/json" });
        requestInfo.body = JSON.stringify({ label, ttlDays });
        return this.fetch(`${this.url}/mcp-tokens?${scopeQuery(tenant, repo, env)}`, Promise.resolve(requestInfo));
    };

    listMcpTokens = async (tenant: string, repo: string, env: string): Promise<McpToken[]> => {
        return this.fetch(`${this.url}/mcp-tokens?${scopeQuery(tenant, repo, env)}`);
    };

    revokeMcpToken = async (tenant: string, repo: string, env: string, id: string): Promise<void> => {
        const query = new URLSearchParams({ tenant, repo, env, id });
        await this.fetch(`${this.url}/mcp-tokens?${query}`, this.getRequestInfo("DELETE"));
    };

    /** The MCP endpoint binds the scope in its path, so agents never repeat it. */
    mcpUrl = (_tenant: string, repo: string, env: string): string => {
        repo = repo ?? this.defaultScope.repo!;
        env = env ?? this.defaultScope.env!;
        // this.url is ".../api/v1"; the MCP endpoint sits beside it, not under it.
        return `${this.url.replace(/\/api\/v1\/?$/, '')}/mcp/${repo}/${env}`;
    };
}

function scopeQuery(tenant: string, repo: string, env: string): string {
    return new URLSearchParams({ tenant, repo, env }).toString();
}

/**
 * The workspace the app is currently showing, read back out of the URL.
 *
 * useWorkspace derives tenant/repo/env from location.pathname rather than holding
 * them in state, and these two fetchAPI methods are given only an element name -
 * so the same derivation has to happen here. The route shape is
 * /:tenant/content/:repo/:env/... behind the hash router.
 */
function currentScope(): { tenant: string; repo: string; env: string } | undefined {
    const path = window.location.hash.replace(/^#/, '').split('?')[0];
    const [tenant, content, repo, env] = path.split('/').filter(part => part.length > 0);
    if (content !== 'content' || !tenant || !repo || !env) return undefined;
    return { tenant, repo, env };
}

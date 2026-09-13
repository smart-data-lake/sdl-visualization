import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CircularProgress,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetcher } from "../../api/Fetcher";
import { McpToken } from "../../api/fetchAPI";
import { useFetchEnvs, useFetchRepos } from "../../hooks/useFetchData";
import { useWorkspace } from "../../hooks/useWorkspace";

/**
 * Tokens for the two things that talk to this backend without a browser: a coding
 * agent over MCP, and an SDLB job uploading what it ran.
 *
 * One kind of token serves both, which is why this page is not called "agent
 * access" - the endpoints differ, the credential does not. It is issued by this
 * backend rather than by Databricks: a Databricks user-to-machine token lasts about
 * an hour, which makes it useless in a job configuration, and it is a credential for
 * a different resource entirely. A token of our own is scoped to one repository and
 * environment, can be named, and can be revoked here without touching Databricks.
 *
 * It is displayed exactly once, because only its hash is stored.
 *
 * The repository and environment are typed here, not read from the URL, and need not
 * exist yet: nothing provisions one until SDLB uploads, and SDLB needs a token first.
 */

/** Mirrors NAME_REQUIRED in backend/src/routes/common.ts. `\w` already contains `_`. */
const SCOPE_NAME = /^[\w-]{1,50}$/;

export function isValidName(name: string): boolean {
  return SCOPE_NAME.test(name);
}

export interface TokenScope {
  tenant: string;
  repo: string;
  env: string;
}

/** What goes into an MCP client's configuration file. */
export function mcpClientConfig(url: string, token: string | undefined): string {
  return JSON.stringify(
    {
      mcpServers: {
        sdlb: { type: "http", url, headers: { Authorization: `Bearer ${token ?? "<your token>"}` } },
      },
    },
    null,
    2,
  );
}

/** The env placeholder, not the token: this snippet usually gets committed. */
export function uiBackendHocon(baseUrl: string, { tenant, repo, env }: TokenScope): string {
  return [
    "global.uiBackend {",
    `  baseUrl = "${baseUrl}"`,
    `  tenant = ${tenant}`,
    `  repo = ${repo}`,
    `  env = ${env}`,
    '  authMode { type = TokenAuthMode, token = "###ENV#SDLB_UI_TOKEN###" }',
    '  stagePath = "/tmp/sdlb-ui-stage"',
    "}",
  ].join("\n");
}

export default function AccessTokens() {
  const { tenant } = useWorkspace();
  const [searchParams] = useSearchParams();

  // Local state, not useWorkspace: a name being typed may not exist, and the context's
  // repo keys fourteen useFetch hooks. Undefined means "not said yet", so the fields
  // can fall back to a default below.
  const [typed, setTyped] = useState<{ repo?: string; env?: string }>({});
  const [tokens, setTokens] = useState<McpToken[] | undefined>();
  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const api = fetcher();
  const { data: repos = [] } = useFetchRepos(tenant!);

  // Derived, not seeded: the defaults depend on lists that arrive asynchronously,
  // which useState cannot see and an effect would race the typing for.
  const repo = typed.repo ?? searchParams.get("repo") ?? repos[0] ?? "";
  // Only for a repository that exists: a half-typed name would be a request per
  // keystroke, and an unuploaded repository has no environments anyway.
  const { data: envs = [] } = useFetchEnvs(tenant!, repos.includes(repo) ? repo : undefined);
  const env = typed.env ?? searchParams.get("env") ?? envs[0] ?? "";

  const scopeValid = isValidName(repo) && isValidName(env);

  // A token is shown once and belongs to one scope; leaving it on screen above a form
  // that now names a different repository invites pasting it into the wrong job.
  const changeScope = (field: "repo" | "env") => (value: string) => {
    setIssued(undefined);
    setTyped((current) => ({ ...current, [field]: value }));
  };

  // Debounced: the scope is typed, so the list must not refetch per keystroke.
  useEffect(() => {
    if (!tenant || !scopeValid || !api.listMcpTokens) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      // Inside the timer: the old list stays put while the scope is still being typed.
      setTokens(undefined);
      api
        .listMcpTokens!(tenant, repo, env)
        .then((listed) => !cancelled && setTokens(listed))
        .catch((caught) => {
          if (cancelled) return;
          setError(caught instanceof Error ? caught.message : String(caught));
          // Otherwise the spinner outlives the request and spins under the error.
          setTokens([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, repo, env, scopeValid]);

  if (!api.createMcpToken || !api.mcpUrl) {
    return (
      <Alert color="neutral" variant="soft" sx={{ m: 2 }}>
        This backend does not serve an MCP endpoint.
      </Alert>
    );
  }

  const scope: TokenScope = { tenant: tenant ?? "", repo, env };
  const url = scopeValid ? api.mcpUrl(scope.tenant, repo, env) : "";
  const upload = scopeValid ? api.uploadUrl?.(scope.tenant, repo, env) : undefined;

  const refresh = async () => {
    if (!api.listMcpTokens || !scopeValid) return;
    setTokens(await api.listMcpTokens(scope.tenant, repo, env));
  };

  const create = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const created = await api.createMcpToken!(scope.tenant, repo, env, label || "MCP client");
      setIssued(created.token);
      setLabel("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await api.revokeMcpToken?.(scope.tenant, repo, env, id);
    await refresh();
  };

  return (
    <Sheet sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
      <Typography level="h4">Access token</Typography>
      <Typography level="body-sm">
        One token for both things that reach this backend without a browser: a coding agent over
        MCP, and an SDLB job uploading its configuration and run history. It is scoped to one
        repository and environment, shown once, and can be revoked here at any time.
      </Typography>

      {error && (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ gap: 1 }}>
        <Typography level="title-md">Issue a token</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
          <ScopeField label="Repository" value={repo} options={repos} onChange={changeScope("repo")} />
          <ScopeField label="Environment" value={env} options={envs} onChange={changeScope("env")} />
          <FormControl sx={{ flexGrow: 1, minWidth: "12rem" }}>
            <FormLabel>Label</FormLabel>
            <Input
              placeholder="What is it for, e.g. my laptop"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormControl>
          <Button onClick={create} loading={busy} disabled={!scopeValid} sx={{ mt: "1.5rem" }}>
            Issue
          </Button>
        </Stack>
        <Typography level="body-xs">
          The repository and environment do not have to exist yet - on a new installation they
          cannot, because nothing creates one until SDLB uploads to it, and this token is what lets
          it. They appear in the switcher above after that first upload; reload the page to see
          them here.
        </Typography>
        {issued && (
          <Alert color="success" variant="soft" sx={{ alignItems: "flex-start" }}>
            <Box>
              <Typography level="title-sm">Copy this now - it is not shown again.</Typography>
              <Typography level="body-xs" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {issued}
              </Typography>
            </Box>
            <IconButton size="sm" onClick={() => copy(issued)} title="Copy the token">
              <ContentCopyIcon />
            </IconButton>
          </Alert>
        )}
      </Card>

      <Card variant="outlined" sx={{ gap: 1 }}>
        <Typography level="title-md">MCP endpoint - for a coding agent</Typography>
        <CodeBlock title="URL" text={url} />
        <Typography level="body-xs">
          An agent connected here can search this configuration, follow lineage and analyse runs. It
          cannot change anything - every tool is read-only. The repository and environment are part
          of the URL, so the agent never has to name them; change the last two segments to connect
          to a different environment.
        </Typography>
        <CodeBlock title=".mcp.json" text={mcpClientConfig(url, issued)} />
        <CodeBlock
          title="or, in Claude Code"
          text={`claude mcp add --transport http sdlb ${url} --header "Authorization: Bearer ${issued ?? "<your token>"}"`}
        />
      </Card>

      {upload && (
        <Card variant="outlined" sx={{ gap: 1 }}>
          <Typography level="title-md">Upload API - for an SDLB job</Typography>
          <CodeBlock title="URL" text={upload} />
          <Typography level="body-xs">
            Where SDLB pushes its exported configuration, schemas, statistics and run state. Unlike
            MCP the scope is not in the URL: SDLB names the tenant, repository and environment as
            configuration keys of its own.
          </Typography>
          <CodeBlock
            title="global.uiBackend, in the SDLB configuration"
            text={uiBackendHocon(upload, scope)}
          />
          <Typography level="body-xs">
            Put the token in the job's <code>SDLB_UI_TOKEN</code> environment variable rather than in
            the file. Set <code>stagePath</code> too: without it a failed upload fails the whole job,
            and with it the run is simply retried next time.
          </Typography>
        </Card>
      )}

      <Card variant="outlined">
        <Typography level="title-md">Your tokens</Typography>
        {!scopeValid ? (
          <Typography level="body-sm">Name a repository and environment to list their tokens.</Typography>
        ) : tokens === undefined ? (
          <CircularProgress size="sm" />
        ) : tokens.length === 0 ? (
          <Typography level="body-sm">None yet.</Typography>
        ) : (
          <Table size="sm">
            <thead>
              <tr>
                <th>Label</th>
                <th>Created</th>
                <th>Last used</th>
                <th style={{ width: "3rem" }} />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td>{token.label}</td>
                  <td>{new Date(token.createdAt).toLocaleString()}</td>
                  <td>{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "never"}</td>
                  <td>
                    <IconButton size="sm" color="danger" onClick={() => revoke(token.id)} title="Revoke">
                      <DeleteIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Sheet>
  );
}

/**
 * Controlled on inputValue, not value: with freeSolo, onChange fires only on Enter or
 * on picking an option, so a name typed and left uncommitted would issue a token
 * against the previous one. Picking an option routes through onInputChange too.
 */
function ScopeField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const invalid = !!value && !isValidName(value);
  return (
    <FormControl error={invalid} sx={{ minWidth: "12rem" }}>
      <FormLabel>{label}</FormLabel>
      <Autocomplete
        freeSolo
        placeholder={`${label.toLowerCase()} name`}
        options={options}
        inputValue={value}
        onInputChange={(_, next) => onChange(next)}
      />
      {invalid && <FormHelperText>Up to 50 characters: letters, digits, underscore, hyphen.</FormHelperText>}
    </FormControl>
  );
}

function CodeBlock({ title, text }: { title: string; text: string }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="body-xs">{title}</Typography>
        <IconButton size="sm" onClick={() => copy(text)} title="Copy">
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1,
          borderRadius: "sm",
          backgroundColor: "background.level1",
          fontSize: "xs",
          overflowX: "auto",
        }}
      >
        {text}
      </Box>
    </Box>
  );
}

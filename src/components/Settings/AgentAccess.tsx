import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Input,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { fetcher } from "../../api/Fetcher";
import { McpToken } from "../../api/fetchAPI";
import { useWorkspace } from "../../hooks/useWorkspace";

/**
 * Give a coding agent access to this repository and environment.
 *
 * The token shown here is issued by this backend, not by Databricks. A Databricks
 * user-to-machine token lasts about an hour, which makes it useless in a
 * configuration file, and it is a credential for a different resource; a token of
 * our own can be named, seen, and revoked.
 *
 * It is displayed exactly once, because only its hash is stored.
 */
export default function AgentAccess() {
  const { tenant, repo, env } = useWorkspace();
  const [tokens, setTokens] = useState<McpToken[] | undefined>();
  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const api = fetcher();
  const ready = !!tenant && !!repo && !!env;

  const refresh = async () => {
    if (!ready || !api.listMcpTokens) return;
    try {
      setTokens(await api.listMcpTokens(tenant!, repo!, env!));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, repo, env]);

  if (!ready) {
    return (
      <Alert color="neutral" variant="soft" sx={{ m: 2 }}>
        Choose a repository and environment first - a token is issued for one of them.
      </Alert>
    );
  }

  if (!api.createMcpToken || !api.mcpUrl) {
    return (
      <Alert color="neutral" variant="soft" sx={{ m: 2 }}>
        This backend does not serve an MCP endpoint.
      </Alert>
    );
  }

  const url = api.mcpUrl(tenant!, repo!, env!);

  const create = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const created = await api.createMcpToken!(tenant!, repo!, env!, label || "MCP client");
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
    await api.revokeMcpToken?.(tenant!, repo!, env!, id);
    await refresh();
  };

  const configJson = JSON.stringify(
    { mcpServers: { sdlb: { type: "http", url, headers: { Authorization: `Bearer ${issued ?? "<your token>"}` } } } },
    null,
    2,
  );
  const cliCommand = `claude mcp add --transport http sdlb ${url} --header "Authorization: Bearer ${issued ?? "<your token>"}"`;

  return (
    <Sheet sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
      <Typography level="h4">Agent access</Typography>
      <Typography level="body-sm">
        An agent connected here can search this configuration, follow lineage and analyse runs. It
        cannot change anything - every tool is read-only.
      </Typography>

      {error && (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ gap: 1 }}>
        <Typography level="title-md">Issue a token</Typography>
        <Stack direction="row" spacing={1}>
          <Input
            placeholder="What is it for, e.g. my laptop"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <Button onClick={create} loading={busy}>
            Issue
          </Button>
        </Stack>
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
        <Typography level="title-md">Point your agent at it</Typography>
        <CodeBlock title=".mcp.json" text={configJson} />
        <CodeBlock title="or, in Claude Code" text={cliCommand} />
        <Typography level="body-xs">
          The repository and environment are part of the URL, so the agent never has to name them.
          Connect to a different environment by changing the last two segments.
        </Typography>
      </Card>

      <Card variant="outlined">
        <Typography level="title-md">Your tokens</Typography>
        {tokens === undefined ? (
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

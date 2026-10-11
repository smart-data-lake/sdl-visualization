import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormControl,
  FormLabel,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { ReactNode, useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { useSearchParams } from "react-router-dom";
import { fetcher } from "../../api/Fetcher";
import { useFetchEnvs, useFetchRepos } from "../../hooks/useFetchData";
import { useWorkspace } from "../../hooks/useWorkspace";

/**
 * Rebuilds the three indexes the backend derives from what SDLB uploaded: the global search
 * index, the run (state) index and the column lineage index. Each rebuild is explicit or lazy
 * on the backend; this page is for forcing one, e.g. after an upgrade changed what they hold.
 */

type Outcome = { color: "success" | "neutral" | "danger"; text: string };

const NEWEST = "";

export default function Indexes() {
  const { tenant } = useWorkspace();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const api = fetcher();

  // Picked here rather than taken from useWorkspace: the settings URL names no repository.
  const [picked, setPicked] = useState<{ repo?: string; env?: string }>({});
  const { data: repos = [] } = useFetchRepos(tenant!);
  const repo = picked.repo ?? searchParams.get("repo") ?? repos[0];
  const { data: envs = [] } = useFetchEnvs(tenant!, repo);
  // the query's env belongs to the query's repo, not to one picked since
  const env = picked.env ?? (picked.repo ? undefined : searchParams.get("env")) ?? envs[0];
  const scoped = !!tenant && !!repo && !!env;

  const { data: versions = [] } = useQuery({
    queryKey: ["indexVersions", tenant, repo, env],
    queryFn: () => api.getConfigVersions(tenant!, repo!, env!),
    enabled: scoped,
    retry: false,
  });
  const [version, setVersion] = useState(NEWEST);
  const [force, setForce] = useState(false);

  // a version of one scope means nothing in another
  const pick = (next: { repo?: string; env?: string }) => {
    setPicked(next);
    setVersion(NEWEST);
  };

  if (!api.rebuildSearchIndex || !api.rebuildStateIndex || !api.rebuildLineageIndex) {
    return (
      <Alert color="neutral" variant="soft" sx={{ m: 2 }}>
        This backend does not build indexes - a statically served project builds them with build_index.sh.
      </Alert>
    );
  }

  const searchIndex = async (): Promise<Outcome> => {
    const result = await api.rebuildSearchIndex!(tenant!, repo!, env!, version || undefined, force);
    queryClient.invalidateQueries("searchIndex");
    const covers = `${result.counts.element} elements, ${result.counts.description} descriptions, ${result.counts.column} columns`;
    if (!result.built) {
      const why = { fresh: "the configuration is unchanged", debounced: "it was rebuilt moments ago", inflight: "a rebuild is already running" };
      return { color: "neutral", text: `Not rebuilt, ${why[result.reason!] ?? result.reason}. Version ${result.version} covers ${covers}.` };
    }
    const truncated = result.truncated?.length ? ` Truncated: ${result.truncated.join(", ")}.` : "";
    return { color: "success", text: `Version ${result.version} rebuilt in ${seconds(result.durationMs)}: ${covers}.${truncated}` };
  };

  const stateIndex = async (): Promise<Outcome> => {
    const result = await api.rebuildStateIndex!(tenant!, repo!, env!);
    ["workflows", "workflow", "workflowRunByAction", "run"].forEach((key) => queryClient.invalidateQueries(key));
    const text = `${result.attempts} attempts of ${result.workflows} workflows reindexed in ${seconds(result.durationMs)}.`;
    if (result.failed.length === 0) return { color: "success", text };
    const failed = result.failed.map((f) => `${f.path}: ${f.error}`).join("; ");
    return { color: "danger", text: `${text} ${result.failed.length} state files could not be read - ${failed}` };
  };

  const lineageIndex = async (): Promise<Outcome> => {
    const result = await api.rebuildLineageIndex!(tenant!, repo!, env!);
    queryClient.invalidateQueries("lineageIndex");
    return { color: "success", text: `Rebuilt from ${result.documents} lineage documents: ${result.edges} column dependencies.` };
  };

  return (
    <Sheet sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography level="h4">Indexes</Typography>
      <Typography level="body-sm">
        Rebuild the indexes of one repository and environment from what SDLB uploaded to it.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <ScopeSelect label="Repository" value={repo} options={repos} onChange={(r) => pick({ repo: r })} />
        <ScopeSelect label="Environment" value={env} options={envs} onChange={(e) => pick({ repo, env: e })} />
      </Stack>

      <RebuildCard
        title="Search index"
        description="What the search box in the title bar searches: the elements, descriptions and schema columns of one configuration version. Built only here or by an SDLB job; without it the search covers the elements alone."
        disabled={!scoped}
        scopeKey={`${repo}/${env}/${version}`}
        rebuild={searchIndex}
      >
        <Stack direction="row" spacing={2} alignItems="flex-end">
          <FormControl sx={{ minWidth: "12rem" }}>
            <FormLabel>Configuration version</FormLabel>
            <Select value={version} onChange={(_, v) => setVersion(v ?? NEWEST)}>
              <Option value={NEWEST}>Newest</Option>
              {versions.map((v) => (
                <Option key={v} value={v}>
                  {v}
                </Option>
              ))}
            </Select>
          </FormControl>
          <Checkbox label="Even if unchanged" checked={force} onChange={(e) => setForce(e.target.checked)} sx={{ pb: 1 }} />
        </Stack>
      </RebuildCard>

      <RebuildCard
        title="State index"
        description="The workflows and runs listed in the workflows explorer, and the last runs of each element. Re-derived from every stored state file, e.g. after an upgrade added a field older runs were indexed without."
        disabled={!scoped}
        scopeKey={`${repo}/${env}`}
        rebuild={stateIndex}
      />

      <RebuildCard
        title="Column lineage index"
        description="Every column dependency, from the newest lineage export of each data object. Rebuilt on the next read whenever a lineage export changed, so this only forces it."
        disabled={!scoped}
        scopeKey={`${repo}/${env}`}
        rebuild={lineageIndex}
      />
    </Sheet>
  );
}

function RebuildCard({
  title,
  description,
  disabled,
  scopeKey,
  rebuild,
  children,
}: {
  title: string;
  description: string;
  disabled: boolean;
  /** The outcome belongs to what it was rebuilt for, so it disappears when that changes. */
  scopeKey: string;
  rebuild: () => Promise<Outcome>;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<(Outcome & { scopeKey: string }) | undefined>();

  const run = async () => {
    setBusy(true);
    setOutcome(undefined);
    try {
      setOutcome({ ...(await rebuild()), scopeKey });
    } catch (caught) {
      setOutcome({ color: "danger", text: caught instanceof Error ? caught.message : String(caught), scopeKey });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ gap: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Typography level="title-md">{title}</Typography>
        <Button onClick={run} loading={busy} disabled={disabled}>
          Rebuild
        </Button>
      </Stack>
      <Typography level="body-sm">{description}</Typography>
      {children}
      {outcome && outcome.scopeKey === scopeKey && (
        <Alert color={outcome.color} variant="soft" sx={{ wordBreak: "break-word" }}>
          {outcome.text}
        </Alert>
      )}
    </Card>
  );
}

function ScopeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FormControl sx={{ minWidth: "12rem" }}>
      <FormLabel>{label}</FormLabel>
      <Select value={value ?? null} placeholder={`${label.toLowerCase()} name`} onChange={(_, v) => v && onChange(v)}>
        {options.map((option) => (
          <Option key={option} value={option}>
            {option}
          </Option>
        ))}
      </Select>
    </FormControl>
  );
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

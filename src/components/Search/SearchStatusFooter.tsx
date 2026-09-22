import { Box, Chip, Tooltip, Typography } from "@mui/joy";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { SearchIndexMeta } from "../../api/fetchAPI";
import type { GlobalSearchState } from "../../hooks/useSearchIndex";

/**
 * What the search is currently able to see. An index is only ever built by an explicit
 * rebuild, so "configuration only" is a normal state and has to be stated rather than
 * looking like an empty result.
 */
export default function SearchStatusFooter(props: {
  coverage: GlobalSearchState['coverage'];
  reason: GlobalSearchState['reason'];
  meta: SearchIndexMeta | undefined;
  scope: GlobalSearchState['scope'];
}) {
  const { coverage, reason, meta, scope } = props;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
      {scope && (
        <Chip size="sm" variant="soft" color="primary" data-testid="search-scope">{scope.label}</Chip>
      )}
      <Typography level="body-xs" sx={{ opacity: 0.8 }} data-testid="search-coverage">
        {text(coverage, reason, meta)}
      </Typography>
      {coverage === 'configOnly' && (
        <Tooltip variant="soft" sx={{ zIndex: 10002, maxWidth: 360 }}
          title="Descriptions and schema columns are indexed by a rebuild on the backend. Until one has run, the search covers the configuration it already has.">
          <InfoOutlinedIcon sx={{ fontSize: '1rem', opacity: 0.7 }} />
        </Tooltip>
      )}
      <Box sx={{ flex: 1 }} />
      <Typography level="body-xs" sx={{ opacity: 0.6 }}>↑↓ to navigate · ↵ to open · esc to close</Typography>
    </Box>
  );
}

function text(coverage: GlobalSearchState['coverage'], reason: GlobalSearchState['reason'], meta?: SearchIndexMeta): string {
  if (coverage === 'full' && meta) {
    return `${meta.documentCount.toLocaleString()} documents · index built ${ago(meta.builtAt)}`;
  }
  if (coverage === 'loading') return 'Loading the full index…';
  if (coverage === 'none') return 'Nothing to search yet.';
  switch (reason) {
    case 'tooLarge': return 'Configuration only — the search index is too large to load here.';
    case 'schemaMismatch': return 'Configuration only — the search index was built by an older version.';
    case 'unreadable': return 'Configuration only — the search index could not be read.';
    case 'error': return 'Configuration only — the search index could not be loaded.';
    default: return 'Configuration only — no search index has been built for this version.';
  }
}

function ago(builtAt: string): string {
  const days = Math.floor((Date.now() - Date.parse(builtAt)) / 86_400_000);
  if (!Number.isFinite(days)) return 'recently';
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

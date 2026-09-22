import { Box, Chip, CircularProgress, IconButton, Input, List, ListItem, Modal, ModalDialog, Typography } from "@mui/joy";
import ClearIcon from '@mui/icons-material/Clear';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalSearch } from "../../hooks/useSearchIndex";
import type { SearchHit } from "../../util/ConfigExplorer/searchIndex";
import SearchResultItem from "./SearchResultItem";
import SearchStatusFooter from "./SearchStatusFooter";

/**
 * The search palette, opened from the title bar or with ctrl/cmd+K.
 *
 * A modal rather than a dropdown under the bar: the header sits at zIndex 10000, above
 * every portalled Joy popup, so an anchored listbox would paint underneath it - and a 45px
 * bar has no room for grouped results with snippets anyway.
 */
export default function SearchPalette(props: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 120);
  const { groups, flat, status, coverage, meta, reason, text, scope } = useGlobalSearch(debounced, true);
  const [active, setActive] = useState(0);
  const [activeFor, setActiveFor] = useState(debounced);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // after the modal's focus trap has run, not with autoFocus, which it competes with
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  // a new query starts at the first result; adjusting during render rather than in an effect
  if (activeFor !== debounced) {
    setActiveFor(debounced);
    setActive(0);
  }

  const open = (hit: SearchHit) => { props.onClose(); navigate(hit.to); };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(i + 1, flat.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && flat[active]) { event.preventDefault(); open(flat[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); props.onClose(); }
  };

  return (
    <Modal open onClose={props.onClose} sx={{ zIndex: 10001 }}>
      <ModalDialog layout="center" data-testid="search-palette"
        sx={{ width: 660, maxWidth: '92vw', maxHeight: '70vh', p: 1, gap: 1, overflow: 'hidden' }}>
        <Input slotProps={{ input: { ref: inputRef } }} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Search data objects, actions, descriptions, columns…"
          data-testid="search-input"
          startDecorator={<SearchOutlinedIcon />}
          endDecorator={query ? (
            <IconButton variant="plain" onClick={() => setQuery('')} sx={{ "--IconButton-size": "24px" }}>
              <ClearIcon />
            </IconButton>) : undefined} />

        <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {status === 'empty' && <ScopeHint />}
          {status === 'noHits' && <Hint>No results for “{text}”{scope ? ` in ${scope.label}` : ''}.</Hint>}
          {status === 'loading' && flat.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size="sm" /></Box>
          )}
          {groups.map(group => (
            <List key={group.title} size="sm" sx={{ '--ListItem-paddingY': '4px' }}>
              <ListItem sticky sx={{ bgcolor: 'background.surface' }}>
                <Typography level="body-xs" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>
                  {group.title}
                </Typography>
              </ListItem>
              {group.hits.map(hit => (
                <SearchResultItem key={hit.docId} hit={hit}
                  selected={flat[active]?.docId === hit.docId}
                  onClick={() => open(hit)}
                  onMouseEnter={() => setActive(flat.indexOf(hit))} />
              ))}
              {group.more > 0 && (
                <ListItem>
                  <Typography level="body-xs" sx={{ opacity: 0.6 }}>+{group.more} more — narrow the search to see them</Typography>
                </ListItem>
              )}
            </List>
          ))}
        </Box>

        <SearchStatusFooter coverage={coverage} reason={reason} meta={meta} scope={scope} />
      </ModalDialog>
    </Modal>
  );
}

const Hint = (props: React.PropsWithChildren) => (
  <Typography level="body-sm" sx={{ p: 2, opacity: 0.8 }}>{props.children}</Typography>
);

/** The empty state is the only place the scope prefixes are discoverable. */
const SCOPE_EXAMPLES = [
  ['do:', 'data objects'], ['action:', 'actions'], ['connection:', 'connections'],
  ['description:', 'description documents'], ['column:', 'schema columns'],
  ['name:', 'names only'], ['type:', 'types only'], ['layer:', 'layers only'],
  ['tag:', 'tags only'], ['feed:', 'feeds only'], ['body:', 'everything else'],
];

const ScopeHint = () => (
  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
    <Typography level="body-sm" sx={{ opacity: 0.8 }}>
      Type at least two characters to search this configuration.
    </Typography>
    <Typography level="body-xs" sx={{ opacity: 0.7 }}>Narrow it with a prefix:</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {SCOPE_EXAMPLES.map(([prefix, what]) => (
        <Chip key={prefix} size="sm" variant="soft" title={what}>{prefix}</Chip>
      ))}
    </Box>
  </Box>
);

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

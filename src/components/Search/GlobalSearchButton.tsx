import { Chip, IconButton, Input } from "@mui/joy";
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useEffect, useState } from "react";
import { useSearchIndexPrefetch } from "../../hooks/useSearchIndex";
import { useWorkspace } from "../../hooks/useWorkspace";
import SearchPalette from "./SearchPalette";

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

/**
 * The search box in the title bar. It only looks like an input - clicking it, or ctrl/cmd+K,
 * opens the palette, which is where the searching happens.
 */
export default function GlobalSearchButton() {
  const { contentPath } = useWorkspace();
  const [open, setOpen] = useState(false);
  const prefetch = useSearchIndexPrefetch();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    // capture, so a handler on the page cannot swallow the shortcut before it gets here
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // nothing to search before a repository and environment are known
  if (!contentPath) return null;

  return (<>
    <Input readOnly size="sm" placeholder="Search" data-testid="global-search"
      onClick={() => setOpen(true)} onMouseEnter={prefetch} onFocus={prefetch}
      startDecorator={<SearchOutlinedIcon fontSize="small" />}
      endDecorator={<Chip size="sm" variant="soft">{isMac ? '⌘K' : 'Ctrl K'}</Chip>}
      sx={{ "--Input-minHeight": "28px", width: 240, flexShrink: 0, cursor: 'pointer',
            // the bar bottom-aligns its children with 7px of padding; this centres the box
            // in its 45px height
            marginBottom: '1.5px',
            display: { xs: 'none', md: 'flex' } }} />
    <IconButton size="sm" variant="plain" onClick={() => setOpen(true)} aria-label="Search"
      sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'inherit', flexShrink: 0, marginBottom: '4px' }}>
      <SearchOutlinedIcon />
    </IconButton>
    {open && <SearchPalette onClose={() => setOpen(false)} />}
  </>);
}

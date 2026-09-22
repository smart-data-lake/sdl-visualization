import { Chip, ListItemButton, ListItemContent, ListItemDecorator, Typography } from "@mui/joy";
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import TableViewTwoToneIcon from '@mui/icons-material/TableViewTwoTone';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { useEffect, useRef } from "react";
import type { SearchHit } from "../../util/ConfigExplorer/searchIndex";
import { highlightTerms } from "./highlight";

function kindIcon(hit: SearchHit) {
  if (hit.kind === 'description') return <ArticleOutlinedIcon fontSize="small" />;
  if (hit.kind === 'column') return <ViewColumnOutlinedIcon fontSize="small" />;
  if (hit.group === 'Actions') return <RocketLaunchOutlinedIcon fontSize="small" />;
  if (hit.group === 'Connections') return <LanOutlinedIcon fontSize="small" />;
  return <TableViewTwoToneIcon fontSize="small" />;
}

export default function SearchResultItem(props: {
  hit: SearchHit;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const { hit, selected } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (selected) ref.current?.scrollIntoView?.({ block: 'nearest' }); }, [selected]);

  return (
    <ListItemButton ref={ref} selected={selected} onClick={props.onClick} onMouseEnter={props.onMouseEnter}
      data-testid="search-result" data-docid={hit.docId}
      sx={{ alignItems: 'flex-start', gap: 1, borderRadius: 'sm' }}>
      <ListItemDecorator sx={{ minInlineSize: '1.5rem', mt: '2px' }}>{kindIcon(hit)}</ListItemDecorator>
      <ListItemContent sx={{ minWidth: 0 }}>
        <Typography level="title-sm" noWrap>{highlightTerms(hit.title, hit.terms)}</Typography>
        <Typography level="body-xs" noWrap sx={{ opacity: 0.8 }}>{hit.subtitle}</Typography>
        {hit.snippet && (
          <Typography level="body-xs" sx={{ opacity: 0.8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {highlightTerms(hit.snippet, hit.terms)}
          </Typography>
        )}
      </ListItemContent>
      {/* says why a hit is here when the snippet does not show the match */}
      {hit.fields.length > 0 && <Chip size="sm" variant="soft" sx={{ flexShrink: 0 }}>{hit.fields[0]}</Chip>}
    </ListItemButton>
  );
}

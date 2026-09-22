import { Box } from "@mui/joy";
import React from "react";

/**
 * Marks the terms MiniSearch reported as matched. They come back lowercased and are matched
 * as prefixes, because that is how they were searched - typing "aviat" reports "aviation".
 */
export function highlightTerms(text: string | undefined, terms: string[]): React.ReactNode {
  if (!text) return null;
  const usable = terms.filter(term => term.length > 1).map(escapeRegExp);
  if (usable.length === 0) return text;

  const pattern = new RegExp(`(${usable.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, index) => (
    pattern.test(part) && index % 2 === 1
      ? <Box key={index} component="mark" sx={{ bgcolor: 'warning.softBg', color: 'inherit', px: 0, borderRadius: '2px' }}>{part}</Box>
      : <React.Fragment key={index}>{part}</React.Fragment>
  ));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

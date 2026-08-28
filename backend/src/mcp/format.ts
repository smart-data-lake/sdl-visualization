import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * How tool results are shaped.
 *
 * Output size is a design property of an MCP server, not an implementation detail:
 * a tool that returns a whole state file costs the caller more context than the
 * answer is worth. So results are compact JSON with undefined stripped, and any
 * list a tool could return unboundedly says how much it left out rather than
 * silently truncating.
 */

export function json(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, replacer, 2) }] };
}

function replacer(_key: string, value: unknown): unknown {
  return value === undefined ? undefined : value;
}

/**
 * A list plus, when it was cut short, a sibling field saying so. Never truncate
 * without saying it: a caller cannot tell a complete answer from a clipped one.
 */
export function truncateList<T>(
  name: string,
  items: T[],
  limit: number,
): Record<string, unknown> {
  if (items.length <= limit) return { [name]: items };
  return {
    [name]: items.slice(0, limit),
    [`${name}Truncated`]: `showing ${limit} of ${items.length}; raise limit to see more`,
  };
}

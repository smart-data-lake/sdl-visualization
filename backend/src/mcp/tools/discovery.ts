import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Scope } from '../../store/keys.js';
import * as config from '../../services/config.js';
import * as runsService from '../../services/runs.js';
import * as descriptions from '../../services/descriptions.js';
import { json, truncateList } from '../format.js';

/**
 * Discovery tools: "is there already something like this, and how does this
 * repository usually do it".
 *
 * Every one of them is a thin wrapper over services/config.ts, which is also what
 * the REST layer calls, so the answers an agent gets are the answers the config
 * explorer would give.
 */

const KIND = z.enum(['dataObjects', 'actions', 'connections']);

export function registerDiscoveryTools(server: McpServer, scope: Scope): void {
  server.registerTool(
    'search_config',
    {
      title: 'Search the configuration',
      description:
        'Find data objects, actions or connections. searchType "id" matches a substring of the ' +
        'element id; "property" takes "<propertyPath>:<regex>", e.g. "type:DeltaLake" or ' +
        '"metadata.layer:integration"; "feedSel" takes SDLB feed selector syntax, e.g. ' +
        '"compute" or "layers:integration&ids:.*airports.*". All matching is case insensitive.',
      inputSchema: z.object({
        query: z.string().describe('the search term, in the syntax the searchType selects'),
        searchType: z.enum(['id', 'property', 'feedSel']).default('id'),
        kind: KIND.optional().describe('restrict the results to one kind of element'),
        version: z.string().optional().describe('configuration version; the newest is used by default'),
        limit: z.number().int().min(1).max(200).default(30),
      }),
    },
    async ({ query, searchType, kind, version, limit }) => {
      const resolved = await config.resolveVersion(scope, version);
      const { hits, total } = await config.searchConfig(
        scope,
        resolved,
        query,
        searchType,
        kind,
        limit,
      );
      return json({ version: resolved, total, shown: hits.length, hits });
    },
  );

  server.registerTool(
    'get_config_element',
    {
      title: 'Get one configuration element',
      description:
        'The full configuration of one data object, action or connection, together with its ' +
        'description, its direct lineage neighbours and the state its last run ended in. ' +
        'One call to understand one element.',
      inputSchema: z.object({
        id: z.string(),
        kind: KIND.optional(),
        version: z.string().optional(),
      }),
    },
    async ({ id, kind, version }) => {
      const resolved = await config.resolveVersion(scope, version);
      const found = await config.getElement(scope, resolved, id, kind);
      if (!found) return json({ error: `No element "${id}" in configuration version ${resolved}` });

      const graph = await config.getGraph(scope, resolved);
      const node = graph.getNodeById(id);
      const neighbours = node
        ? {
            upstream: graph.getDirectNeighbours(node, 'backward').map((n) => n.id),
            downstream: graph.getDirectNeighbours(node, 'forward').map((n) => n.id),
          }
        : { upstream: [], downstream: [] };

      const history = await runsService.getElementHistory(
        scope,
        found.kind === 'actions' ? 'action' : 'dataObject',
        id,
        1,
      );

      const description = await descriptions
        .getDescription(scope, resolved, `${found.kind}/${id}.md`)
        .catch(() => undefined);

      return json({
        version: resolved,
        kind: found.kind,
        element: found.element,
        neighbours,
        lastRun: history[0]
          ? {
              workflow: history[0].workflow,
              runId: history[0].runId,
              attemptId: history[0].attemptId,
              state: history[0].state,
              at: history[0].attemptStartTime,
            }
          : undefined,
        description: description ? description.body.toString('utf8') : undefined,
      });
    },
  );

  server.registerTool(
    'find_similar_dataobjects',
    {
      title: 'Find data objects like an existing one',
      description:
        'Existing elements sharing a type, layer or connection, ranked by how much they share. ' +
        'Use this before writing a new data object, so the new one follows the conventions of ' +
        'this repository instead of inventing its own.',
      inputSchema: z.object({
        id: z.string().optional().describe('an existing element to resemble'),
        kind: KIND.default('dataObjects'),
        type: z.string().optional(),
        layer: z.string().optional(),
        connectionId: z.string().optional(),
        version: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ id, kind, type, layer, connectionId, version, limit }) => {
      const resolved = await config.resolveVersion(scope, version);
      const hits = await config.findSimilar(
        scope,
        resolved,
        kind,
        { id, type, layer, connectionId },
        limit,
      );
      return json({ version: resolved, hits });
    },
  );

  server.registerTool(
    'list_config_patterns',
    {
      title: 'List the conventions of this repository',
      description:
        'Group the configuration by one property and count each group, with a few example ids. ' +
        'The cheapest way to learn how this repository does things before changing it.',
      inputSchema: z.object({
        kind: KIND.default('dataObjects'),
        groupBy: z
          .enum(['type', 'layer', 'connectionId', 'executionMode', 'transformerType'])
          .default('type'),
        version: z.string().optional(),
      }),
    },
    async ({ kind, groupBy, version }) => {
      const resolved = await config.resolveVersion(scope, version);
      const groups = await config.configPatterns(scope, resolved, kind, groupBy);
      return json({ version: resolved, kind, groupBy, groups });
    },
  );

  server.registerTool(
    'get_lineage',
    {
      title: 'Get the lineage around an element',
      description:
        'The neighbourhood of one element as a compact edge list. view "data" gives a graph of ' +
        'data objects, "action" a graph of actions where each edge is the data object two ' +
        'actions share, and "full" has both as nodes.',
      inputSchema: z.object({
        id: z.string(),
        direction: z.enum(['upstream', 'downstream', 'both']).default('both'),
        depth: z.number().int().min(1).max(10).default(2),
        view: z.enum(['full', 'data', 'action']).default('full'),
        version: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    },
    async ({ id, direction, depth, view, version, limit }) => {
      const resolved = await config.resolveVersion(scope, version);
      const full = await config.getGraph(scope, resolved);
      const base =
        view === 'data' ? full.getDataGraph() : view === 'action' ? full.getActionGraph() : full;

      const neighbourhood = base.getNeighbourhood(id, direction, depth);
      if (neighbourhood.nodes.length === 0) {
        return json({
          error: `"${id}" is not a node of the ${view} graph of version ${resolved}`,
          hint: view === 'data' ? 'actions are not nodes of the data graph' : undefined,
        });
      }

      const edges = neighbourhood.edges.map((e) => ({
        from: e.source,
        to: e.target,
        via: e.dataObjectId,
      }));
      return json({
        version: resolved,
        view,
        center: id,
        nodes: neighbourhood.nodes.map((n) => n.id),
        ...truncateList('edges', edges, limit),
      });
    },
  );
}

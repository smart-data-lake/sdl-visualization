import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  ConfigData as FrontendConfigData,
  InitialConfigDataLists,
} from '../../../src/util/ConfigExplorer/ConfigData.ts';
import { getMainInputCount, getMainOutputCount } from '../../../src/util/WorkflowsExplorer/metrics.ts';
import { ConfigDataLists_ } from '../../src/domain/filter.js';
import { buildFullGraph } from '../../src/domain/graph.js';
import {
  getMainInputCount as portedMainInput,
  getMainOutputCount as portedMainOutput,
} from '../../src/domain/metrics.js';
import { FIXTURES } from '../../scripts/seed-fixtures.js';

/**
 * The ported domain logic, checked against the frontend originals it was copied from.
 *
 * This is the test that matters for the three copies in src/domain: metrics, the
 * graph model and the configuration filters. Mirroring the frontend's own test cases
 * would only prove the copy passes the same examples; running both implementations
 * over the real getting-started configuration and asserting they agree is what
 * actually catches drift, including in cases nobody thought to write a case for.
 *
 * The frontend modules import cleanly under Node - their reactflow and dagre imports
 * are type-only and get elided - so no shimming is needed.
 */

const configJson = JSON.parse(
  await readFile(path.join(FIXTURES, 'exported/exportedConfig.json'), 'utf8'),
);
const stateFile = JSON.parse(
  await readFile(path.join(FIXTURES, 'shared/state/succeeded/getting-started.24.1.json'), 'utf8'),
);

const frontendConfig = new FrontendConfigData(structuredClone(configJson));
const frontendLists = () => new InitialConfigDataLists(frontendConfig);
const portedLists = () => new ConfigDataLists_(structuredClone(configJson));

const ids = (list: { id: string }[]) => list.map((e) => e.id).sort();

describe('configuration search matches the config explorer', () => {
  test('the element lists start out the same', () => {
    const frontend = frontendLists();
    const ported = portedLists();
    expect(ids(ported.dataObjects)).toEqual(ids(frontend.dataObjects));
    expect(ids(ported.actions)).toEqual(ids(frontend.actions));
    expect(ids(ported.connections)).toEqual(ids(frontend.connections));
  });

  test.each([
    ['id', 'airports'],
    ['id', 'AIRPORTS'],
    ['id', 'departures'],
    ['id', 'nothing-matches-this'],
  ])('contains filter on %s:%s', (prop, value) => {
    const frontend = frontendLists().applyContainsFilter(prop, value);
    const ported = portedLists().applyContainsFilter(prop, value);
    expect(ids(ported.dataObjects)).toEqual(ids(frontend.dataObjects));
    expect(ids(ported.actions)).toEqual(ids(frontend.actions));
  });

  test.each([
    ['type', 'DeltaLake'],
    ['Type', 'deltalake'],
    ['metadata.layer', 'integration'],
    ['metadata.LAYER', 'INTEGRATION'],
    ['metadata.tags', 'airport'],
    ['type', '.*Action'],
  ])('regex filter on %s:%s', (prop, regex) => {
    const frontend = frontendLists().applyRegexFilter(prop, regex);
    const ported = portedLists().applyRegexFilter(prop, regex);
    expect(ids(ported.dataObjects)).toEqual(ids(frontend.dataObjects));
    expect(ids(ported.actions)).toEqual(ids(frontend.actions));
    expect(ids(ported.connections)).toEqual(ids(frontend.connections));
  });

  test.each(['compute', 'download', 'ids:.*airports.*', 'compute|download', 'download-.*&feeds:download'])(
    'feed filter %s',
    (feedSel) => {
      const frontend = frontendLists().applyFeedFilter(feedSel);
      const ported = portedLists().applyFeedFilter(feedSel);
      expect(ids(ported.actions)).toEqual(ids(frontend.actions));
      expect(ids(ported.dataObjects)).toEqual(ids(frontend.dataObjects));
      expect(ids(ported.connections)).toEqual(ids(frontend.connections));
    },
  );

  test('the unimplemented feed prefixes still throw', () => {
    expect(() => portedLists().applyFeedFilter('startFromActionIds:x')).toThrow(/not yet implemented/);
  });
});

describe('the lineage graph matches the config explorer', () => {
  const ported = buildFullGraph(configJson).graph;

  const sorted = (values: string[]) => [...values].sort();
  const nodeIds = (graph: { nodes: { id: string }[] }) => sorted(graph.nodes.map((n) => n.id));
  const edgeIds = (graph: { edges: { id: string }[] }) => sorted(graph.edges.map((e) => e.id));

  test('the full graph has the same nodes and edges', () => {
    expect(nodeIds(ported)).toEqual(nodeIds(frontendConfig.fullGraph!));
    expect(edgeIds(ported)).toEqual(edgeIds(frontendConfig.fullGraph!));
  });

  test('the data graph has the same nodes and edges', () => {
    expect(nodeIds(ported.getDataGraph())).toEqual(nodeIds(frontendConfig.dataGraph!));
    expect(edgeIds(ported.getDataGraph())).toEqual(edgeIds(frontendConfig.dataGraph!));
  });

  test('the action graph has the same nodes and edges, and the same data object per edge', () => {
    const portedActions = ported.getActionGraph();
    const frontendActions = frontendConfig.actionGraph!;
    expect(nodeIds(portedActions)).toEqual(nodeIds(frontendActions));
    expect(edgeIds(portedActions)).toEqual(edgeIds(frontendActions));

    const via = (graph: { edges: { id: string; dataObjectId?: string }[] }) =>
      Object.fromEntries(graph.edges.map((e) => [e.id, e.dataObjectId]));
    expect(via(portedActions)).toEqual(via(frontendActions));
  });

  test('a subgraph is restricted the same way', () => {
    const some = nodeIds(frontendConfig.dataGraph!).slice(0, 3);
    expect(nodeIds(ported.getDataGraph().getSubGraph(some))).toEqual(
      nodeIds(frontendConfig.dataGraph!.getSubGraph(some)),
    );
  });
});

describe('run metrics match the run table', () => {
  test.each(Object.keys(stateFile.actionsState))('%s reports the same counts', (name) => {
    const action = stateFile.actionsState[name];
    expect(portedMainInput(action)).toEqual(getMainInputCount(action));
    expect(portedMainOutput(action)).toEqual(getMainOutputCount(action));
  });
});

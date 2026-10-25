import { describe, expect, test } from 'vitest';
import type { ReactFlowInstance } from 'reactflow';
import { DAGraph, DataObject, Edge as GraphEdge } from '../src/util/ConfigExplorer/Graphs';
import { prepareAndRenderGraph, withExpandedSides } from '../src/util/ConfigExplorer/LineageTabUtils';

// p feeds c and, through another action, s directly; c feeds s - two paths from p to s
const [p, c, s] = ['p', 'c', 's'].map(id => new DataObject(id));
const graph = new DAGraph([p, c, s], [new GraphEdge(p, c, 'p->c'), new GraphEdge(c, s, 'c->s'), new GraphEdge(p, s, 'p->s')]);

const render = (elementName: string, isExpanded: boolean) => prepareAndRenderGraph({} as ReactFlowInstance, {
  graphView: 'data', layout: 'TB', layoutMode: 'layered', isExpanded, grouping: {},
  props: { configData: { dataGraph: graph }, elementName, elementType: 'dataObjects' },
} as any);

const ids = (edges: {id: string}[]) => edges.map(edge => edge.id).sort();

describe('the edges between the nodes shown', () => {
  test('two neighbours of the selected element are connected too', () => {
    const { edges } = render('c', false);
    expect(ids(edges)).toEqual(['c->s', 'p->c', 'p->s']);
  });

  test('and an ancestor feeding a descendant directly, in the expanded graph', () => {
    const { edges } = render('c', true);
    expect(ids(edges)).toEqual(['c->s', 'p->c', 'p->s']);
  });

  test('the added edge counts as active on both ends, so collapsing takes it away', () => {
    const { nodes } = render('c', false);
    const data = (id: string) => nodes.find(node => node.id === id)!.data;
    expect(data('p').numFwdActiveEdges).toBe(2);
    expect(data('s').numBwdActiveEdges).toBe(2);
  });

  test('a side whose neighbours it connects are all shown is expanded, so its handle offers to collapse', () => {
    const { nodes } = render('c', false);
    const data = (id: string) => nodes.find(node => node.id === id)!.data;
    expect(data('p').isExpandedForward).toBe(true);
    expect(data('s').isExpandedBackward).toBe(true);
  });

  test('a side is expanded where every edge on it is shown, however it came to be shown', () => {
    // e.g. selecting p spliced in the chain to c, which was shown before without p->c
    const node = (id: string) => ({id, data: {}} as any);
    const sides = withExpandedSides(['p', 'c', 's'].map(node), [{id: 'p->c'}, {id: 'c->s'}] as any, graph);
    const of = (id: string) => sides.find(n => n.id === id)!.data;
    expect(of('c')).toMatchObject({isExpandedForward: true, isExpandedBackward: true});
    expect(of('p').isExpandedForward).toBe(false); // p->s is not shown
    expect(of('s').isExpandedBackward).toBe(false);
  });
});

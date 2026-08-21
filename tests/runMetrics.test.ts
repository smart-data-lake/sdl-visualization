/**
 * Tests the metrics shown on the action graph of a run attempt: the fallback chain over the metric
 * names SDLB records, the `<name>#<inputId>` convention for input metrics, and which of them end up
 * on an edge resp. next to a node.
 */
import { expect, test } from 'vitest';
import { Action, ResultMetrics } from '../src/types.ts';
import { getRunMetrics, Lineage } from '../src/util/WorkflowsExplorer/Lineage.ts';
import { getInputMetric, getOutputMetric } from '../src/util/WorkflowsExplorer/metrics.ts';

function action(inputIds: string[], outputs: {dataObjectId: string, metrics?: ResultMetrics}[]): Action {
    return {
        executionId: {type: 'SDLExecutionId', runId: 1, attemptId: 1},
        state: 'SUCCEEDED', duration: 'PT1S', msg: '',
        startTstmp: new Date(0),
        inputIds,
        outputIds: outputs.map(output => output.dataObjectId),
        results: outputs.map(output => ({type: 'SparkSubFeed', partitionValues: [], ...output})),
    };
}

test('the output metric is the first one the action recorded', () => {
    const counted = action([], [{dataObjectId: 'do', metrics: {count: 5, records_written: 7, files_written: 1}}]);
    expect(getOutputMetric(counted, 'do')).toMatchObject({dataObjectId: 'do', name: 'count', value: 5});

    const written = action([], [{dataObjectId: 'do', metrics: {records_written: 7, files_written: 1}}]);
    expect(getOutputMetric(written, 'do')).toMatchObject({dataObjectId: 'do', name: 'records_written', value: 7});

    const files = action([], [{dataObjectId: 'do', metrics: {files_written: 1}}]);
    expect(getOutputMetric(files, 'do')).toMatchObject({dataObjectId: 'do', name: 'files_written', value: 1});
});

test('an action without metrics has none', () => {
    // a cancelled or failed action records an empty metrics bag
    expect(getOutputMetric(action([], [{dataObjectId: 'do', metrics: {}}]), 'do')).toBeUndefined();
    expect(getOutputMetric(action([], [{dataObjectId: 'do'}]), 'do')).toBeUndefined();
    expect(getOutputMetric(undefined, 'do')).toBeUndefined();
    // metrics of another output do not count
    expect(getOutputMetric(action([], [{dataObjectId: 'other', metrics: {count: 5}}]), 'do')).toBeUndefined();
    // a non numeric metric is not a data flow
    expect(getOutputMetric(action([], [{dataObjectId: 'do', metrics: {count: undefined, stage: 'save'}}]), 'do')).toBeUndefined();
});

test('input metrics are qualified with the input id and sit on the output result', () => {
    const join = action(['in1', 'in2'], [{dataObjectId: 'out', metrics: {
        count: 663, 'count#mainInput': 83330, 'count#in1': 83330, 'count#in2': 666,
    }}]);
    expect(getInputMetric(join, 'in1')).toMatchObject({dataObjectId: 'in1', name: 'count#in1', value: 83330});
    expect(getInputMetric(join, 'in2')).toMatchObject({dataObjectId: 'in2', name: 'count#in2', value: 666});
    // count#mainInput duplicates the main input's own metric and is not a data object
    expect(getInputMetric(join, 'mainInput')).toBeUndefined();
    // an input the action recorded nothing for
    expect(getInputMetric(action(['in1'], [{dataObjectId: 'out', metrics: {count: 1}}]), 'in1')).toBeUndefined();
    // the fallback chain applies to input metrics as well
    const files = action(['in1'], [{dataObjectId: 'out', metrics: {'files_written#in1': 2}}]);
    expect(getInputMetric(files, 'in1')).toMatchObject({dataObjectId: 'in1', name: 'files_written#in1', value: 2});
});

test('a metric carries every metric of its data object, for the tooltip', () => {
    // the shape of a join in the getting-started example: one output, two inputs
    const join = action(['int-departures', 'int-airports'], [{dataObjectId: 'out', metrics: {
        count: 663, num_output_bytes: 16837, 'count#mainInput': 83330, 'count#int-airports': 83330,
        records_written: 663, 'count#int-departures': 666, stage: 'save',
    }}]);

    // an output lists the unqualified metrics - the qualified ones describe the inputs
    expect(getOutputMetric(join, 'out')!.all).toEqual([
        {name: 'count', value: 663},
        {name: 'num_output_bytes', value: 16837},
        {name: 'records_written', value: 663},
        {name: 'stage', value: 'save'},
    ]);

    // an input lists the metrics qualified with its own id, and no other input's
    expect(getInputMetric(join, 'int-departures')!.all).toEqual([{name: 'count#int-departures', value: 666}]);
    expect(getInputMetric(join, 'int-airports')!.all).toEqual([{name: 'count#int-airports', value: 83330}]);
});

/*
    ext -> load -> mid -> use -> end, i.e. one edge (via mid) plus a dangling input (ext) and a
    dangling output (end)
*/
test('metrics without an edge to sit on are returned per node', () => {
    const actions = new Map<string, Action>([
        ['load', action(['ext'], [{dataObjectId: 'mid', metrics: {count: 759}}])],
        ['use', action(['mid'], [{dataObjectId: 'end', metrics: {count: 663, 'count#mid': 666}}])],
    ]);
    const graph = new Lineage([...actions].map(([name, a]) =>
        ({action: name, inputIds: a.inputIds!, outputIds: a.outputIds!}))).graph.getActionGraph();

    const {edgeMetrics, nodeMetrics} = getRunMetrics(graph, actions);

    // the only edge carries what load wrote to mid and what use read from it
    expect([...edgeMetrics.keys()]).toEqual(['load->mid->use']);
    expect(edgeMetrics.get('load->mid->use')).toMatchObject({
        output: {dataObjectId: 'mid', name: 'count', value: 759},
        input: {dataObjectId: 'mid', name: 'count#mid', value: 666},
    });

    // end is written but never read, so its metric has no edge and belongs to the node
    expect(nodeMetrics.get('use')).toMatchObject({outputs: [{dataObjectId: 'end', name: 'count', value: 663}], inputs: []});
    // load reads ext, which no action produced, but it recorded no metric for it
    expect(nodeMetrics.has('load')).toBe(false);
});

/*
    The historization pattern: historize reads and writes int, which makes it its own successor.
*/
test('an action reading and writing the same data object has no edge to itself', () => {
    const historize = action(['stg', 'int'], [{dataObjectId: 'int', metrics: {count: 83330}}]);
    const actions = new Map<string, Action>([['historize', historize]]);
    const graph = new Lineage([{action: 'historize', inputIds: ['stg', 'int'], outputIds: ['int']}])
        .graph.getActionGraph();

    // an edge back to the action itself says nothing about how the actions are connected
    expect(graph.edges.length).toBe(0);

    const {edgeMetrics, nodeMetrics} = getRunMetrics(graph, actions);

    // so what historize wrote to int is shown next to the node instead
    expect(edgeMetrics.size).toBe(0);
    expect(nodeMetrics.get('historize')).toMatchObject({outputs: [{dataObjectId: 'int', name: 'count', value: 83330}], inputs: []});
});

test('a data object read by another action too is covered by that edge', () => {
    const actions = new Map<string, Action>([
        ['historize', action(['stg', 'int'], [{dataObjectId: 'int', metrics: {count: 83330}}])],
        ['join', action(['int'], [{dataObjectId: 'out', metrics: {count: 663, 'count#int': 83330}}])],
    ]);
    const graph = new Lineage([
        {action: 'historize', inputIds: ['stg', 'int'], outputIds: ['int']},
        {action: 'join', inputIds: ['int'], outputIds: ['out']},
    ]).graph.getActionGraph();

    const {edgeMetrics, nodeMetrics} = getRunMetrics(graph, actions);

    // int flows to join, so its metrics sit on that edge and are not repeated next to historize
    expect([...edgeMetrics.keys()]).toEqual(['historize->int->join']);
    expect(edgeMetrics.get('historize->int->join')).toMatchObject({
        output: {dataObjectId: 'int', name: 'count', value: 83330},
        input: {dataObjectId: 'int', name: 'count#int', value: 83330},
    });
    expect(nodeMetrics.has('historize')).toBe(false);
    // out is written but read by nobody
    expect(nodeMetrics.get('join')).toMatchObject({outputs: [{dataObjectId: 'out', name: 'count', value: 663}], inputs: []});
});

import type { Action, ResultMetrics } from "./types.js";

/**
 * How much data flowed through a data object, in order of preference: the first metric an action
 * recorded for that data object wins. SDLB writes `count` for DataFrame based actions,
 * `records_written` when it only knows the number of written records and `files_written` for file
 * actions.
 */
const METRIC_NAMES = ['count', 'records_written', 'files_written'];

/** What SDLB puts between a metric name and the input it belongs to, e.g. count#int-airports */
const QUALIFIER_SEPARATOR = '#';

/** The qualifier SDLB uses for the main input of an action, next to the input's own data object id */
const MAIN_INPUT = 'mainInput';

/** One entry of the metrics an action recorded, as it appears in the state file */
export interface FlowMetricEntry {
    name: string;
    value: number | string | boolean;
}

/** One metric describing the data flow between an action and one of its data objects */
export interface FlowMetric {
    dataObjectId: string;
    /** the metric key as it appears in the state file, e.g. "count" or "count#int-airports" */
    name: string;
    value: number;
    /** every metric the action recorded for this data object, sorted by name */
    all: FlowMetricEntry[];
}

function numericMetric(metrics: ResultMetrics | undefined, name: string): number | undefined {
    const value = metrics?.[name];
    return typeof value === 'number' ? value : undefined;
}

function metricEntries(metrics: ResultMetrics | undefined, belongsToDataObject: (name: string) => boolean): FlowMetricEntry[] {
    return Object.entries(metrics || {})
        .filter(([name, value]) => value !== undefined && belongsToDataObject(name))
        .map(([name, value]) => ({name, value: value as number | string | boolean}))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The metric describing what the action wrote to one of its output data objects. Output metrics are
 * recorded unqualified on the result of that very data object.
 */
export function getOutputMetric(action: Action | undefined, dataObjectId: string): FlowMetric | undefined {
    const metrics = action?.results?.find(result => result.dataObjectId === dataObjectId)?.metrics;
    // the qualified metrics on this result describe the inputs of the action, not this output
    const all = metricEntries(metrics, name => !name.includes(QUALIFIER_SEPARATOR));
    for (const name of METRIC_NAMES) {
        const value = numericMetric(metrics, name);
        if (value !== undefined) return { dataObjectId, name, value, all };
    }
    return undefined;
}

/**
 * The metric describing what the action read from one of its input data objects. Input metrics
 * describe the action and not one of its outputs, but SDLB records them on the results of the
 * outputs, qualified with `#<inputId>` - so all results have to be searched. `count#mainInput` is
 * ignored on purpose, it duplicates the main input's own `count#<inputId>`.
 */
export function getInputMetric(action: Action | undefined, dataObjectId: string): FlowMetric | undefined {
    if (dataObjectId === MAIN_INPUT) return undefined;
    const qualifier = `${QUALIFIER_SEPARATOR}${dataObjectId}`;
    // the same input metrics are repeated on the result of every output, so keep the first of each
    const all: FlowMetricEntry[] = [];
    (action?.results || []).forEach(result =>
        metricEntries(result.metrics, name => name.endsWith(qualifier))
            .filter(entry => !all.some(seen => seen.name === entry.name))
            .forEach(entry => all.push(entry)));
    all.sort((a, b) => a.name.localeCompare(b.name));

    for (const name of METRIC_NAMES) {
        const qualified = `${name}${qualifier}`;
        const value = all.find(entry => entry.name === qualified)?.value;
        if (typeof value === 'number') return { dataObjectId, name: qualified, value, all };
    }
    return undefined;
}

/**
 * The first of METRIC_NAMES the action recorded over all its results, optionally qualified with
 * `#<qualifier>`, i.e. belonging to one of its inputs.
 */
function findFlowMetric(action: Action | undefined, qualifier?: string): number | undefined {
    for (const name of METRIC_NAMES) {
        const key = qualifier ? `${name}${QUALIFIER_SEPARATOR}${qualifier}` : name;
        for (const result of action?.results || []) {
            const value = numericMetric(result.metrics, key);
            if (value !== undefined) return value;
        }
    }
    return undefined;
}

/**
 * How much the action read from its main input. SDLB records it qualified with `mainInput`, next to
 * the same metric qualified with that input's own data object id.
 */
export function getMainInputCount(action: Action | undefined): number | undefined {
    return findFlowMetric(action, MAIN_INPUT);
}

/**
 * How much the action wrote to its main output. The state file does not mark which result is the
 * main output, so the first one that recorded such a metric is taken - which is unambiguous for the
 * actions with a single output, i.e. nearly all of them.
 */
export function getMainOutputCount(action: Action | undefined): number | undefined {
    return findFlowMetric(action);
}

/*
 * Ported verbatim from src/util/WorkflowsExplorer/metrics.ts of the frontend, with only the
 * import rewritten. tests/runMetrics.test.ts is run against this copy too - see test/unit.
 */

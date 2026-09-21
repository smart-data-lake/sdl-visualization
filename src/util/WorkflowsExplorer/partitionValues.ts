import { Action } from '../../types';

/**
 * The partition values an action processed, as one line of text.
 *
 * SDLB records them per result (`results[].partitionValues`), where an execution mode that
 * selects partitions puts the selection it made. The same value appears on every output the
 * action wrote, hence the de-duplication.
 *
 * Copied into backend/src/domain/partitionValues.ts and build_index.py - change all three.
 */

/** Beyond this many values the cell says how many more there are; a backfill can have hundreds. */
export const MAX_PARTITION_VALUES = 10;

/** One partition value: `dt=2024-01-01`, several keys joined by `/`. */
export function formatPartitionValue(value: any): string {
    // older state files wrap the map in `elements`, and updateStateFile only unwraps that form
    // for results that still carry a subFeed
    const elements = value?.elements ?? value;
    if (elements === null || elements === undefined) return '';
    if (typeof elements !== 'object') return String(elements);
    return Object.entries(elements).map(([key, element]) => `${key}=${element}`).join('/');
}

/** Distinct partition values as one cell of a table, longest lists abbreviated. */
export function formatPartitionValues(values: any[] | undefined): string {
    const formatted = (values || []).map(formatPartitionValue).filter(value => value.length > 0);
    const distinct = formatted.filter((value, index) => formatted.indexOf(value) === index);
    if (distinct.length <= MAX_PARTITION_VALUES) return distinct.join(', ');
    return distinct.slice(0, MAX_PARTITION_VALUES).join(', ') + `, … (+${distinct.length - MAX_PARTITION_VALUES} more)`;
}

/** What an action selected, or undefined if it selected nothing - the table shows an empty cell. */
export function selectedPartitionValues(action: Action): string | undefined {
    const values = (action.results || []).flatMap(result => result.partitionValues || []);
    return formatPartitionValues(values) || undefined;
}

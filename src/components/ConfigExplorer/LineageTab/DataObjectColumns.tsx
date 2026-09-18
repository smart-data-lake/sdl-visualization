import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/joy/Box';
import LinearProgress from '@mui/joy/LinearProgress';
import Tooltip from '@mui/joy/Tooltip';
import Typography from '@mui/joy/Typography';
import { Handle, Position } from 'reactflow';

import { useWorkspace } from '../../../hooks/useWorkspace';
import { ColumnDisplay, ColumnInfo, lessColumns, moreColumns } from '../../../util/ConfigExplorer/ColumnModel';
import { ForeignKeyIcon, PrimaryKeyIcon, UnresolvedForeignKeyIcon } from './ColumnIcons';
import './LineageTab.css';

/*
    The columns of a DataObject, rendered inside its node so that the node reads like a table of an
    entity relation diagram: a title, a rule under it, then one row per column.

    Every column carries a ReactFlow handle on each side, so that a relation between two columns can
    be drawn onto the rows themselves rather than onto the nodes. The handles are absolutely
    positioned inside their row, so the browser does the vertical arithmetic and an anchor can never
    drift away from the row it belongs to - but the *node* must declare a height that matches what
    these constants add up to, because the layout has to know how tall a node is before it renders.
    That is what nodeHeightFor is for; it and the CSS below have to stay in step.
*/
export const NODE_WIDTH = 200;
export const NODE_WIDTH_WITH_COLUMNS = 260;
/** the title of the node, and the expand control at its lower border */
export const NODE_HEADER_HEIGHT = 92;
export const COLUMN_ROW_HEIGHT = 20;
/*
    The font of a column row. It lives here rather than in LineageTab.css because a Joy Typography
    brings its own font-size through emotion, which is injected after the stylesheet and wins - so
    the size has to be passed to the component, and the line box is tied to the row height anyway.
*/
export const COLUMN_FONT_SIZE = 14;
const columnTextStyle = {fontSize: `${COLUMN_FONT_SIZE}px`, lineHeight: `${COLUMN_ROW_HEIGHT}px`};
/** the rule between the title and the first column row */
export const COLUMNS_DIVIDER_HEIGHT = 7;

/** The handle a relation edge attaches to for one column. Unique within its node. */
export const columnHandleId = (kind: 'source' | 'target', columnKey: string) => `col-${kind}:${columnKey}`;

/*
    The handle a relation edge attaches to while the node is closed.

    A relation is a horizontal thing: it runs from a row on one side to a row on the other, and a
    column handle is therefore always on the left or the right border. A closed node has to offer
    the same orientation, otherwise an edge whose one end has been opened leaves the other end's
    bottom border and has to swing around the node to come back to a left border. So the relations
    view does not use the node's layout driven handle - which points down in a top to bottom
    layout - but these two, which are always left and right.
*/
export const nodeRelationHandleId = (kind: 'source' | 'target', nodeId: string) => `node-${kind}:${nodeId}`;

/** How tall a node is that shows the given number of column rows. */
export function nodeHeightFor(columnCount: number | undefined): number {
    if (!columnCount) return NODE_HEADER_HEIGHT;
    return NODE_HEADER_HEIGHT + COLUMNS_DIVIDER_HEIGHT + columnCount * COLUMN_ROW_HEIGHT;
}

/** How wide a node is - a node showing columns needs the room for a name and a type. */
export function nodeWidthFor(showColumns: boolean): number {
    return showColumns ? NODE_WIDTH_WITH_COLUMNS : NODE_WIDTH;
}

/*
    A handle is positioned against the nearest positioned ancestor, which is the node's *padded* box
    - and, inside the column block, the column row. Neither of them reaches the node's outer border,
    so an offset meant to land on that border has to undo the difference. The node publishes both
    distances as custom properties, because a highlighted node has a thicker border.
*/
export const NODE_BORDER_VAR = 'var(--lineage-node-border, 3px)';
const COLUMN_INSET_VAR = 'var(--lineage-column-inset, 13px)';

/*
    A column handle is only an anchor for an edge, it is never dragged from. It is centred on the
    border of its side - the anchor is the centre of the box - so that a relation edge meets the
    node exactly there, with neither its end hidden under the node nor a gap before it.
*/
const handleStyle = {
    width: 1, height: 1, minWidth: 0, minHeight: 0,
    border: 0, background: 'transparent',
    top: '50%',
};
const sideHandleStyle = (side: 'left' | 'right', inset: string, outset: number = 0) => ({
    ...handleStyle,
    [side]: `calc(-1 * ${inset} - ${outset}px)`,
    transform: `translate(${side === 'left' ? '-50%' : '50%'}, -50%)`,
});
/** inside a column row, so it has to clear the node's border and its padding */
const columnHandleStyle = (side: 'left' | 'right') => sideHandleStyle(side, COLUMN_INSET_VAR);

/*
    What a column has to say for itself, or nothing.

    A column that is only a primary key - int-departures.icao24, say - has nothing to add to what
    the row already shows, and a tooltip that opens on an empty box is worse than none at all.
*/
function referenceTitle(column: ColumnInfo): JSX.Element | undefined {
    const hasSomethingToSay = column.description !== undefined
        || column.references.length > 0 || column.referencedBy.length > 0 || column.declaredOnly;
    if (!hasSomethingToSay) return undefined;
    return (
        <Box>
            {column.description && <div>{column.description}</div>}
            {column.references.map((reference, i) => (
                <div key={`ref-${i}`}>
                    → {reference.dataObjectId}.{reference.column}
                    {reference.resolved ? '' : ' (not in this configuration)'}
                </div>
            ))}
            {column.referencedBy.map((incoming, i) => (
                <div key={`inc-${i}`}>← {incoming.dataObjectId}.{incoming.fromColumn}</div>
            ))}
            {column.declaredOnly && <div><i>declared by a key, not in the exported schema</i></div>}
        </Box>
    );
}

/*
    The data object at the other end of this column's relation - only when there is exactly one.

    A column can take part in several relations, in either direction: a primary key is typically
    referenced by every table that points at it, and the same column can be the referencing side of
    more than one foreign key. Then there is no "the other end" to navigate to, and picking one of
    them would be a guess, so the name is not a link. Several relations to the *same* data object
    are not ambiguous - two foreign keys between the same pair of tables still lead to one place -
    so what is counted is the distinct data objects, not the relations.

    The tooltip lists them all either way.
*/
function relatedDataObjectId(column: ColumnInfo): string | undefined {
    const related = new Set([
        // a reference this configuration does not describe has nothing to navigate to
        ...column.references.filter(reference => reference.resolved).map(reference => reference.dataObjectId),
        ...column.referencedBy.map(incoming => incoming.dataObjectId),
    ]);
    return related.size === 1 ? related.values().next().value : undefined;
}

/*
    One column. The key icons are siblings of the handles, never their children - a handle with
    content in it would be draggable and would show up as an interactive part of the graph.
*/
function ColumnRow({column}: {column: ColumnInfo}) {
    const hasReference = column.references.length > 0;
    const isUnresolved = hasReference && column.references.every(reference => !reference.resolved);
    const hasAnyRelation = hasReference || column.referencedBy.length > 0;
    const { navigateContent } = useWorkspace();

    const title = referenceTitle(column);
    // the name of a column that takes part in a relation leads to the data object at its other end
    const relatedId = relatedDataObjectId(column);

    const label = (
        <Box className="lineage-column-label">
            {/* a key and a link, not two weights of the same key: at this size only the
                shape is legible, and the colour is never the only difference */}
            {column.isPrimaryKey && <PrimaryKeyIcon/>}
            {hasReference && !isUnresolved && <ForeignKeyIcon/>}
            {isUnresolved && <UnresolvedForeignKeyIcon/>}
            <Typography level="body-xs"
                        className={`lineage-column-name${relatedId ? ' lineage-column-link' : ''}`}
                        sx={{...columnTextStyle, fontStyle: column.declaredOnly ? 'italic' : undefined}}
                        onClick={relatedId ? () => navigateContent(`config/dataObjects/${relatedId}`) : undefined}>
                {column.name}
            </Typography>
            <Box sx={{flex: 1}}/>
            {column.dataType &&
                <Typography level="body-xs" className="lineage-column-type" sx={columnTextStyle}>
                    {column.dataType}
                </Typography>}
        </Box>
    );

    return (
        <Box className="lineage-column-row" data-testid={`column-${column.key}`}>
            {hasAnyRelation &&
                <Handle type="target" position={Position.Left} id={columnHandleId('target', column.key)}
                        className="lineage-column-handle" style={columnHandleStyle('left')}/>}
            {/* a column with nothing to add to what the row already shows gets no tooltip at all */}
            {title
                ? <Tooltip title={title} arrow disableInteractive size="sm" placement="right" enterDelay={300}>
                    {label}
                  </Tooltip>
                : label}
            {hasAnyRelation &&
                <Handle type="source" position={Position.Right} id={columnHandleId('source', column.key)}
                        className="lineage-column-handle" style={columnHandleStyle('right')}/>}
        </Box>
    );
}

/**
 * The handles a relation edge attaches to while the node is closed - see nodeRelationHandleId.
 *
 * They are anchored on the middle of the title rather than of the whole node, so that an edge keeps
 * pointing at the table's name as the node grows and shrinks with its columns.
 */
export function NodeRelationHandles({nodeId, outsetLeft = 0, outsetRight = 0}: {
    nodeId: string,
    /*
        In a left to right layout these sit on the same two borders, at the same height, as the
        node's graph expand buttons - so where one of those is shown, the relation edge has to clear
        it too, or its arrow head ends up behind it. See EXPAND_BUTTON_OUTSET.
    */
    outsetLeft?: number,
    outsetRight?: number,
}) {
    // a child of the node's padded box, so it only has to clear the border
    const top = `calc(${NODE_HEADER_HEIGHT / 2}px - ${NODE_BORDER_VAR})`;
    return (
        <>
            <Handle type="target" position={Position.Left} id={nodeRelationHandleId('target', nodeId)}
                    className="lineage-column-handle"
                    style={{...sideHandleStyle('left', NODE_BORDER_VAR, outsetLeft), top}}/>
            <Handle type="source" position={Position.Right} id={nodeRelationHandleId('source', nodeId)}
                    className="lineage-column-handle"
                    style={{...sideHandleStyle('right', NODE_BORDER_VAR, outsetRight), top}}/>
        </>
    );
}

/**
 * The column block of an expanded node, under the rule that separates it from the title.
 *
 * While the exported schema is still being fetched the block holds a placeholder of exactly one
 * row's height, so that the node does not change size between the placeholder and the columns that
 * replace it.
 */
export function ColumnList({columns, isLoading}: {columns: ColumnInfo[], isLoading?: boolean}) {
    return (
        <Box className="lineage-column-list">
            {columns.map(column => <ColumnRow key={column.key} column={column}/>)}
            {isLoading && columns.length === 0 &&
                <Box className="lineage-column-row">
                    <LinearProgress size="sm" sx={{width: '100%'}}/>
                </Box>}
            {!isLoading && columns.length === 0 &&
                <Box className="lineage-column-row">
                    <Typography level="body-xs" sx={{...columnTextStyle, fontStyle: 'italic', opacity: 0.6}}>
                        no columns
                    </Typography>
                </Box>}
        </Box>
    );
}

/*
    The control at the lower border of a data object node, as wide as the node itself.

    It walks the three displays in both directions. Closed, it is one button that opens the node on
    its key columns; open on the keys it is two, one per direction, so that the step on to all
    columns and the step back are equally reachable; open on all columns only the way back is left.
    A step that would not add anything - a table whose every column is a key column - is not offered.

    The chevrons sit at the two outer ends and each keeps its end throughout: closing is always on
    the left, opening always on the right. The middle of the strip is not part of either of them,
    because the node's own graph expand handle is anchored there - the edges attach in the middle of
    the border, so the handle cannot move, and a click there has to expand the graph rather than
    open the columns. The strip still spans the node; only what is clickable stops short of the
    middle. A direction that is not available keeps its place as an empty half, so that the other
    chevron does not wander to the other end.
*/
export function ColumnsToggle({display, onChange, nodeId, hasMore}: {
    display: ColumnDisplay,
    onChange: (display: ColumnDisplay) => void,
    nodeId: string,
    /** whether opening further would actually show anything that is not shown already */
    hasMore: boolean,
}) {
    const canOpen = display !== 'all' && hasMore;
    const canClose = display !== 'none';
    const openTitle = display === 'none' ? 'Show key columns' : 'Show all columns';
    const closeTitle = display === 'all' ? 'Show key columns only' : 'Hide columns';

    return (
        <Box className="lineage-column-toggle">
            {canClose
                ? <Tooltip title={closeTitle} arrow disableInteractive size="sm" enterDelay={300}>
                    <button type="button" className="lineage-column-toggle-button"
                            aria-label={closeTitle} data-testid={`columns-collapse-${nodeId}`}
                            onClick={() => onChange(lessColumns(display))}>
                        <ExpandLessIcon className="lineage-column-toggle-icon"/>
                    </button>
                  </Tooltip>
                : <span className="lineage-column-toggle-button lineage-column-toggle-empty"/>}
            {canOpen
                ? <Tooltip title={openTitle} arrow disableInteractive size="sm" enterDelay={300}>
                    <button type="button" className="lineage-column-toggle-button"
                            aria-label={openTitle} data-testid={`columns-expand-${nodeId}`}
                            onClick={() => onChange(moreColumns(display))}>
                        <ExpandMoreIcon className="lineage-column-toggle-icon"/>
                    </button>
                  </Tooltip>
                : <span className="lineage-column-toggle-button lineage-column-toggle-empty"/>}
        </Box>
    );
}

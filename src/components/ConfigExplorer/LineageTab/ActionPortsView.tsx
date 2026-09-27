import Box from '@mui/joy/Box';
import Tooltip from '@mui/joy/Tooltip';
import Typography from '@mui/joy/Typography';
import { Handle, Position } from 'reactflow';

import { ActionPorts, connectionKey, OutputPort, PortRow } from '../../../util/ConfigExplorer/ActionPorts';
import { COLUMN_ROW_HEIGHT, COLUMN_TEXT_STYLE, columnHandleStyle, portHandleId, transformationText } from './DataObjectColumns';
import './LineageTab.css';

/*
    The body of an expanded action node: the columns it reads on the left, the columns it writes on
    the right, grouped under their data objects, and a curve per input column feeding an output
    column in between. A connected port leads a straight line from its name to the curves, so that
    no curve runs over a long name. Every port carries a handle on the outer border, so that the edges of the
    full view can run from a column of a data object to the port reading it (see columnLineageEdges).
    Rows are COLUMN_ROW_HEIGHT like the rows of a data object, which nodeSizeFor relies on.
*/

const SVG_WIDTH = 100; // the connections are drawn in a stretched box, see preserveAspectRatio

function rowIndexOf(rows: PortRow[]): Map<string, number> {
    const index = new Map<string, number>();
    rows.forEach((row, i) => { if ('port' in row) index.set(row.port.key, i); });
    return index;
}

const middleOf = (row: number) => row * COLUMN_ROW_HEIGHT + COLUMN_ROW_HEIGHT / 2;

// the curve already shows which columns it connects
const connectionTitle = (texts: string[]): string => texts.length > 0 ? texts.join('; ') : 'unchanged';

function outputTitle(port: OutputPort): string {
    if (port.unresolved) return `${port.dataObjectId}.${port.column}\nlineage could not be traced`;
    return `${port.dataObjectId}.${port.column}` + (port.expression ? `\n${port.expression}` : '');
}

function PortRowView({row, side, traced, connected}: {row: PortRow, side: 'input' | 'output', traced: Set<string>, connected: Set<string>}) {
    if ('caption' in row) {
        return (
            <Box className="lineage-column-row lineage-port-caption"
                 sx={{justifyContent: side === 'output' ? 'flex-end' : 'flex-start'}}>
                <Typography level="body-xs" noWrap title={row.caption}
                            sx={{...COLUMN_TEXT_STYLE, fontStyle: 'italic', opacity: 0.7, textAlign: side === 'output' ? 'right' : 'left'}}>
                    {row.caption}
                </Typography>
            </Box>
        );
    }
    const port = row.port;
    const title = side === 'input' ? `${port.dataObjectId}.${port.column}` : outputTitle(port as OutputPort);
    const isUnresolved = side === 'output' && (port as OutputPort).unresolved;
    // a straight line from the name to the middle band, where the curves are, whatever the name's length
    // drawn like the curves, with the same stroke, so that the two read as one line
    const lead = connected.has(port.key) &&
        <svg className="lineage-port-lead" viewBox={`0 0 ${SVG_WIDTH} ${COLUMN_ROW_HEIGHT}`} preserveAspectRatio="none"
             height={COLUMN_ROW_HEIGHT}>
            <path d={`M0,${COLUMN_ROW_HEIGHT / 2} L${SVG_WIDTH},${COLUMN_ROW_HEIGHT / 2}`}
                  className="lineage-port-connection-line" vectorEffect="non-scaling-stroke"/>
        </svg>;
    return (
        <Box className={`lineage-column-row lineage-port-row lineage-port-${side}${traced.has(port.key) ? ' lineage-column-traced' : ''}`}
             data-testid={`port-${side}-${port.key}`}
             sx={{justifyContent: side === 'output' ? 'flex-end' : 'flex-start'}}>
            {side === 'input' &&
                <Handle type="target" position={Position.Left} id={portHandleId('target', port.key)}
                        className="lineage-column-handle" style={columnHandleStyle('left')}/>}
            {side === 'output' && lead}
            <Tooltip title={<span style={{whiteSpace: 'pre-line'}}>{title}</span>} arrow disableInteractive size="sm"
                     placement={side === 'input' ? 'left' : 'right'} enterDelay={300}>
                <Typography level="body-xs" className="lineage-column-name"
                            sx={{...COLUMN_TEXT_STYLE, fontStyle: isUnresolved ? 'italic' : undefined}}>
                    {port.column}
                </Typography>
            </Tooltip>
            {side === 'input' && lead}
            {side === 'output' &&
                <Handle type="source" position={Position.Right} id={portHandleId('source', port.key)}
                        className="lineage-column-handle" style={columnHandleStyle('right')}/>}
        </Box>
    );
}

export function ActionPortsView({ports, tracedConnections}: {ports: ActionPorts, tracedConnections?: string[]}) {
    const traced = new Set(tracedConnections ?? []);
    const tracedPorts = new Set(ports.connections.filter(c => traced.has(connectionKey(c.from, c.to))).flatMap(c => [c.from, c.to]));
    const inputRow = rowIndexOf(ports.inputRows), outputRow = rowIndexOf(ports.outputRows);
    const connected = new Set(ports.connections.flatMap(c => [c.from, c.to]));
    const height = Math.max(ports.inputRows.length, ports.outputRows.length, 1) * COLUMN_ROW_HEIGHT;
    // the traced ones last, so that they are drawn over the others
    const connections = [...ports.connections].sort((a, b) =>
        Number(traced.has(connectionKey(a.from, a.to))) - Number(traced.has(connectionKey(b.from, b.to))));

    return (
        <Box className="lineage-column-list">
            <Box className="lineage-port-body" sx={{height}}>
                <Box className="lineage-port-side">
                    {ports.inputRows.map((row, i) => <PortRowView key={i} row={row} side="input" traced={tracedPorts} connected={connected}/>)}
                </Box>
                <svg className="lineage-port-connections" viewBox={`0 0 ${SVG_WIDTH} ${height}`} preserveAspectRatio="none"
                     height={height}>
                    {connections.map(connection => {
                        const from = inputRow.get(connection.from), to = outputRow.get(connection.to);
                        if (from === undefined || to === undefined) return null;
                        const [y1, y2] = [middleOf(from), middleOf(to)];
                        const d = `M0,${y1} C${SVG_WIDTH / 2},${y1} ${SVG_WIDTH / 2},${y2} ${SVG_WIDTH},${y2}`;
                        const key = connectionKey(connection.from, connection.to);
                        const texts = connection.transformations.map(transformationText).filter((t): t is string => t !== undefined);
                        return (
                            <Tooltip key={key} title={<span style={{whiteSpace: 'pre-line'}}>{connectionTitle(texts)}</span>}
                                     arrow disableInteractive followCursor size="sm" enterDelay={300}>
                                <g className={`lineage-port-connection${traced.has(key) ? ' lineage-port-connection-traced' : ''}`}
                                   data-testid={`connection-${key}`}>
                                    <path d={d} className="lineage-port-connection-hit" vectorEffect="non-scaling-stroke"/>
                                    <path d={d} className="lineage-port-connection-line" vectorEffect="non-scaling-stroke"
                                          strokeDasharray={texts.length > 0 ? '4 2' : undefined}/>
                                </g>
                            </Tooltip>
                        );
                    })}
                </svg>
                <Box className="lineage-port-side">
                    {ports.outputRows.map((row, i) => <PortRowView key={i} row={row} side="output" traced={tracedPorts} connected={connected}/>)}
                </Box>
            </Box>
        </Box>
    );
}

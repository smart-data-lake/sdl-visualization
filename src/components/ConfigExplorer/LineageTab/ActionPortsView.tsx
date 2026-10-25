import Box from '@mui/joy/Box';
import Tooltip from '@mui/joy/Tooltip';
import Typography from '@mui/joy/Typography';
import { Handle, Position } from 'reactflow';

import { useFetchColumnLineageIndex } from '../../../hooks/useFetchData';
import { useLineageGraph } from '../../../hooks/useLineage';
import { ActionPorts, connectionKey, OutputPort, Port, PortConnection, PortRow } from '../../../util/ConfigExplorer/ActionPorts';
import { columnId } from '../../../util/ConfigExplorer/columnLineage';
import { indexedColumnIds } from '../../../util/ConfigExplorer/LineageTabUtils';
import { COLUMN_ROW_HEIGHT, COLUMN_TEXT_STYLE, columnHandleStyle, portHandleId, transformationText } from './DataObjectColumns';
import './LineageTab.css';
import { useTruncated } from './useTruncated';

/*
    The body of an expanded action node: the columns it reads on the left, the columns it writes on
    the right, grouped under their data objects, and a curve per input column feeding an output
    column in between. A connected port leads a straight line from its name to the curves, so that
    no curve runs over a long name; the lead of an output port tells how the column is computed.
    Every port carries a handle on the outer border, so that the edges of the full and action views can run to and from it (see columnLineageEdges). A port's name traces its column.
    Rows are COLUMN_ROW_HEIGHT like the rows of a data object, which nodeSizeFor relies on.
*/

const SVG_WIDTH = 100; // the connections are drawn in a stretched box, see preserveAspectRatio

function rowIndexOf(rows: PortRow[]): Map<string, number> {
    const index = new Map<string, number>();
    rows.forEach((row, i) => { if ('port' in row) index.set(row.port.key, i); });
    return index;
}

const middleOf = (row: number) => row * COLUMN_ROW_HEIGHT + COLUMN_ROW_HEIGHT / 2;

const textsOf = (connection: PortConnection): string[] =>
    connection.transformations.map(transformationText).filter((t): t is string => t !== undefined);

/** How an output column is computed: once if all its inputs agree, as SDLB repeats an expression per input, else per input. */
function transformationTitle(connections: PortConnection[], inputName: (key: string) => string): string {
    const texts = connections.map(c => textsOf(c).join('; ') || 'unchanged');
    if (new Set(texts).size <= 1) return texts[0] ?? 'unchanged';
    return connections.map((c, i) => `${inputName(c.from)}: ${texts[i]}`).join('\n');
}

function outputTitle(port: OutputPort): string {
    if (port.unresolved) return `${port.dataObjectId}.${port.column}\nlineage could not be traced`;
    return `${port.dataObjectId}.${port.column}` + (port.expression ? `\n${port.expression}` : '');
}

/** The data object the ports below it belong to, named in full by a tooltip where it is cut off. */
function PortCaption({caption, side}: {caption: string, side: 'input' | 'output'}) {
    const {truncated, onMouseEnter} = useTruncated();
    return (
        <Box className="lineage-column-row lineage-port-caption"
             sx={{justifyContent: side === 'output' ? 'flex-end' : 'flex-start'}}>
            <Tooltip title={truncated ? caption : ''} arrow disableInteractive size="sm"
                     placement={side === 'input' ? 'left' : 'right'} enterDelay={300}>
                <Typography level="body-xs" noWrap onMouseEnter={onMouseEnter}
                            sx={{...COLUMN_TEXT_STYLE, fontStyle: 'italic', opacity: 0.7, textAlign: side === 'output' ? 'right' : 'left'}}>
                    {caption}
                </Typography>
            </Tooltip>
        </Box>
    );
}

/** How a port's name starts and stops a column trace, like a column row of a data object. */
interface PortTrace {
    traceable: (port: Port) => boolean;
    isStart: (port: Port) => boolean;
    toggle: (port: Port) => void;
}

function PortRowView({row, side, traced, connected, trace, transformation}: {row: PortRow, side: 'input' | 'output', traced: Set<string>, connected: Set<string>, trace: PortTrace, transformation?: (key: string) => string}) {
    if ('caption' in row) return <PortCaption caption={row.caption} side={side}/>;
    const port = row.port;
    const title = side === 'input' ? `${port.dataObjectId}.${port.column}` : outputTitle(port as OutputPort);
    const isUnresolved = side === 'output' && (port as OutputPort).unresolved;
    const traceable = !isUnresolved && trace.traceable(port);
    const isStart = trace.isStart(port);
    const tooltip = traceable ? `${title}\n${isStart ? 'stop tracing column' : 'trace column'}` : title;
    // a straight line from the name to the middle band, where the curves are, whatever the name's length
    // drawn like the curves, with the same stroke, so that the two read as one line
    const leadSvg = connected.has(port.key) &&
        <svg className="lineage-port-lead" viewBox={`0 0 ${SVG_WIDTH} ${COLUMN_ROW_HEIGHT}`} preserveAspectRatio="none"
             height={COLUMN_ROW_HEIGHT} data-testid={side === 'output' ? `transformation-${port.key}` : undefined}>
            {side === 'output' && <rect width={SVG_WIDTH} height={COLUMN_ROW_HEIGHT} className="lineage-port-lead-hit"/>}
            <path d={`M0,${COLUMN_ROW_HEIGHT / 2} L${SVG_WIDTH},${COLUMN_ROW_HEIGHT / 2}`}
                  className="lineage-port-connection-line" vectorEffect="non-scaling-stroke"/>
        </svg>;
    // the whole row height of the lead is the target, as it is one line per output however many inputs feed it
    const lead = leadSvg && side === 'output' && transformation
        ? <Tooltip title={<span style={{whiteSpace: 'pre-line'}}>{transformation(port.key)}</span>}
                   arrow disableInteractive size="sm" placement="top" enterDelay={300}>
            {leadSvg}
          </Tooltip>
        : leadSvg;
    return (
        <Box className={`lineage-column-row lineage-port-row lineage-port-${side}${traced.has(port.key) ? ' lineage-column-traced' : ''}${isStart ? ' lineage-column-trace-start' : ''}`}
             data-testid={`port-${side}-${port.key}`}
             sx={{justifyContent: side === 'output' ? 'flex-end' : 'flex-start'}}>
            {side === 'input' &&
                <Handle type="target" position={Position.Left} id={portHandleId('target', port.key)}
                        className="lineage-column-handle" style={columnHandleStyle('left')}/>}
            {side === 'output' && lead}
            <Tooltip title={<span style={{whiteSpace: 'pre-line'}}>{tooltip}</span>} arrow disableInteractive size="sm"
                     placement={side === 'input' ? 'left' : 'right'} enterDelay={300}>
                <Typography level="body-xs" className={`lineage-column-name${traceable ? ' lineage-column-link nodrag' : ''}`}
                            data-testid={traceable ? `trace-port-${side}-${port.key}` : undefined}
                            onClick={traceable ? () => trace.toggle(port) : undefined}
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
    const { tracedColumn, setTracedColumn } = useLineageGraph();
    const { data: index } = useFetchColumnLineageIndex();
    const inIndex = index ? indexedColumnIds(index) : undefined;
    const ref = (port: Port) => ({dataObjectId: port.dataObjectId, column: port.column});
    const isStart = (port: Port) => tracedColumn !== undefined && columnId(tracedColumn) === columnId(ref(port));
    // without an index the ports themselves come from the lineage, so every one of them can be traced
    const trace: PortTrace = {
        traceable: port => !inIndex || inIndex.has(columnId(ref(port))),
        isStart,
        toggle: port => setTracedColumn(isStart(port) ? undefined : ref(port)),
    };
    const traced = new Set(tracedConnections ?? []);
    const tracedPorts = new Set(ports.connections.filter(c => traced.has(connectionKey(c.from, c.to))).flatMap(c => [c.from, c.to]));
    const inputRow = rowIndexOf(ports.inputRows), outputRow = rowIndexOf(ports.outputRows);
    const connected = new Set(ports.connections.flatMap(c => [c.from, c.to]));
    const inputs = new Map(ports.inputs.map(port => [port.key, port]));
    const inputName = (key: string) => { const p = inputs.get(key); return p ? `${p.dataObjectId}.${p.column}` : key; };
    const transformation = (output: string) => transformationTitle(ports.connections.filter(c => c.to === output), inputName);
    const height = Math.max(ports.inputRows.length, ports.outputRows.length, 1) * COLUMN_ROW_HEIGHT;
    // the traced ones last, so that they are drawn over the others
    const connections = [...ports.connections].sort((a, b) =>
        Number(traced.has(connectionKey(a.from, a.to))) - Number(traced.has(connectionKey(b.from, b.to))));

    return (
        <Box className="lineage-column-list">
            <Box className="lineage-port-body" sx={{height}}>
                <Box className="lineage-port-side">
                    {ports.inputRows.map((row, i) => <PortRowView key={i} row={row} side="input" traced={tracedPorts} connected={connected} trace={trace}/>)}
                </Box>
                <svg className="lineage-port-connections" viewBox={`0 0 ${SVG_WIDTH} ${height}`} preserveAspectRatio="none"
                     height={height}>
                    {connections.map(connection => {
                        const from = inputRow.get(connection.from), to = outputRow.get(connection.to);
                        if (from === undefined || to === undefined) return null;
                        const [y1, y2] = [middleOf(from), middleOf(to)];
                        const d = `M0,${y1} C${SVG_WIDTH / 2},${y1} ${SVG_WIDTH / 2},${y2} ${SVG_WIDTH},${y2}`;
                        const key = connectionKey(connection.from, connection.to);
                        return (
                            <g key={key} className={`lineage-port-connection${traced.has(key) ? ' lineage-port-connection-traced' : ''}`}
                               data-testid={`connection-${key}`}>
                                <path d={d} className="lineage-port-connection-hit" vectorEffect="non-scaling-stroke"/>
                                <path d={d} className="lineage-port-connection-line" vectorEffect="non-scaling-stroke"
                                      strokeDasharray={textsOf(connection).length > 0 ? '4 2' : undefined}/>
                            </g>
                        );
                    })}
                </svg>
                <Box className="lineage-port-side">
                    {ports.outputRows.map((row, i) => <PortRowView key={i} row={row} side="output" traced={tracedPorts} connected={connected} trace={trace} transformation={transformation}/>)}
                </Box>
            </Box>
        </Box>
    );
}

import Close from '@mui/icons-material/Close';
import { Box, Button, IconButton, Sheet, Tooltip, Typography } from '@mui/joy';
import { Panel, useNodes, useReactFlow } from 'reactflow';

import { LayoutDirection } from '../../../util/ConfigExplorer/LineageLayout';
import { ColumnRef } from '../../../util/ConfigExplorer/columnLineage';
import { flowProps, getGraph, GraphTrace, GraphView, spliceNodePath, traceEnds } from '../../../util/ConfigExplorer/LineageTabUtils';

/*
  What a column trace covers, beside the graph: the columns it begins and ends with, and a way to
  add what the graph does not show of it. The graph only highlights what it shows, so without this a trace
  into a part of the pipeline that is collapsed would look shorter than it is.
*/
export function ColumnTracePanel({trace, complete, props, graphView, layout, onClose}: {
  trace: GraphTrace,
  /** false where no index was built and the trace only knows the lineage of the nodes shown */
  complete: boolean,
  props: flowProps,
  graphView: GraphView,
  layout: LayoutDirection,
  onClose: () => void,
}) {
  const reactFlow = useReactFlow();
  const shown = new Set(useNodes().map(node => node.id));
  const graph = getGraph(props, graphView);
  const {starts, ends} = traceEnds(trace);

  // what this view could show of the trace: its data objects, and in the full and action views its actions
  const withActions = graphView === 'full' || graphView === 'action';
  const onTrace = new Set([...trace.columns.keys(), ...(withActions ? trace.edges.map(edge => edge[4]) : [])]);
  const missing = [...onTrace].filter(id => !shown.has(id) && graph.getNodeById(id) !== undefined);

  const showMissing = () => {
    missing.forEach(id => spliceNodePath(reactFlow, props, id, graphView, layout));
    setTimeout(() => reactFlow.fitView({duration: 400}), 0);
  };

  return (
    <Panel position="bottom-center">
      <Sheet variant="outlined" data-testid="column-trace-panel"
             sx={{display: 'flex', flexDirection: 'column', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 'sm', boxShadow: 'sm', maxWidth: 640}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <Typography level="body-sm" sx={{whiteSpace: 'nowrap', flex: 1}}>
            <b>{trace.start.dataObjectId}.{trace.start.column}</b>
            {!complete && ' - among the data objects shown, no lineage index was built'}
          </Typography>
          {missing.length > 0 &&
            <Button size="sm" variant="soft" onClick={showMissing} data-testid="column-trace-show">
              Show all
            </Button>}
          <Tooltip title="Stop tracing" size="sm">
            <IconButton size="sm" onClick={onClose} aria-label="Stop tracing"><Close/></IconButton>
          </Tooltip>
        </Box>
        <Box sx={{display: 'flex', gap: 3, maxHeight: 160, overflowY: 'auto', pb: 0.5}}>
          <ColumnRefList title="Source columns" columns={starts} testId="column-trace-starts"/>
          <ColumnRefList title="Target columns" columns={ends} testId="column-trace-ends"/>
        </Box>
      </Sheet>
    </Panel>
  );
}

function ColumnRefList({title, columns, testId}: {title: string, columns: ColumnRef[], testId: string}) {
  return (
    <Box data-testid={testId} sx={{minWidth: 0}}>
      <Typography level="body-xs" fontWeight="lg">{title}</Typography>
      {columns.map(column => (
        <Typography key={`${column.dataObjectId}.${column.column}`} level="body-xs" noWrap>
          {column.dataObjectId}.{column.column}
        </Typography>
      ))}
    </Box>
  );
}

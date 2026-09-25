import Close from '@mui/icons-material/Close';
import { Button, IconButton, Sheet, Tooltip, Typography } from '@mui/joy';
import { Panel, useNodes, useReactFlow } from 'reactflow';

import { LayoutDirection } from '../../../util/ConfigExplorer/LineageLayout';
import { flowProps, getGraph, GraphTrace, GraphView, spliceNodePath } from '../../../util/ConfigExplorer/LineageTabUtils';

/*
  What a column trace covers, beside the graph: how far it reaches, how much of it the graph does
  not show, and a way to add that. The graph only highlights what it shows, so without this a trace
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
  const columnCount = [...trace.columns.values()].reduce((sum, columns) => sum + columns.size, 0) - 1;

  // what this view could show of the trace: its data objects, and in the full view its actions too
  const onTrace = new Set([...trace.columns.keys(), ...(graphView === 'full' ? trace.edges.map(edge => edge[4]) : [])]);
  const missing = [...onTrace].filter(id => !shown.has(id) && graph.getNodeById(id) !== undefined);

  const showMissing = () => {
    missing.forEach(id => spliceNodePath(reactFlow, props, id, graphView, layout));
    setTimeout(() => reactFlow.fitView({duration: 400}), 0);
  };

  return (
    <Panel position="bottom-center">
      <Sheet variant="outlined" data-testid="column-trace-panel"
             sx={{display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: 'sm', boxShadow: 'sm'}}>
        <Typography level="body-sm" sx={{whiteSpace: 'nowrap'}}>
          <b>{trace.start.dataObjectId}.{trace.start.column}</b>
          {columnCount === 0 ? ': no dependencies' : `: ${columnCount} column${columnCount === 1 ? '' : 's'} in ${trace.columns.size} data objects`}
          {!complete && ' - among the data objects shown, no lineage index was built'}
        </Typography>
        {missing.length > 0 &&
          <Button size="sm" variant="soft" onClick={showMissing} data-testid="column-trace-show">
            Show {missing.length} more
          </Button>}
        <Tooltip title="Stop tracing" size="sm">
          <IconButton size="sm" onClick={onClose} aria-label="Stop tracing"><Close/></IconButton>
        </Tooltip>
      </Sheet>
    </Panel>
  );
}

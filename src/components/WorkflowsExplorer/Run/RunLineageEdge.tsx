import { FC } from 'react';
import EdgeLabelRenderer, {EdgeProps, getBezierPath } from 'react-flow-renderer';
import BaseEdge from 'react-flow-renderer';

const RunLineageEdge: FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
        <BaseEdge/>
    </>
  );
};

export default RunLineageEdge;

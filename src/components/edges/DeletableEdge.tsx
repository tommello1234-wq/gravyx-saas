import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
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
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan pointer-events-auto absolute flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-white shadow-md hover:scale-110 transition-transform"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setEdges((eds) => eds.filter((edge) => edge.id !== id));
            }}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

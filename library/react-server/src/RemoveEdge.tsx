import React, { useState } from "react";
import styled from "styled-components";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@reactflow/core";
import useStore from "./store";
import { Position } from "reactflow";
import { Dict } from "./backend/typing";

const EdgePathContainer = styled.g`
  path:nth-child(2) {
    pointer-events: all;
    &:hover {
      & + .edgebutton {
        // Make add node button visible
        visibility: visible;
      }
    }
  }
`;

export interface CustomEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style: Dict;
  markerEnd?: string;
  data?: {
    colored?: boolean;
  };
}

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: CustomEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [hovering, setHovering] = useState(false);
  const removeEdge = useStore((state) => state.removeEdge);
  const updateEdge = useStore((state) => state.updateEdge);

  const onEdgeClick = (
    evt: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    evt.stopPropagation();
    removeEdge(id);
  };

  const onPathClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    updateEdge(id, { colored: !data?.colored });
  };

  const edgeColor = data?.colored ? "#47fc0a" : (hovering ? "#000" : "#999");
  // Thanks in part to oshanley https://github.com/wbkd/react-flow/issues/1211#issuecomment-1585032930
  return (
    <EdgePathContainer
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <path
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={style.strokeWidth || 5}
        stroke={edgeColor}
        // markerEnd={markerEnd}
        fill="none"
        onClick={onPathClick}
        style={{ cursor: 'pointer' }}
        // style={{ ...style, stroke: edgeColor ? "#000" : "#999" }}
      />
      {/* <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: edgeColor ? "#000" : "#999" }}
        // onClick={onPathClick}
      /> */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: "all",
            visibility: hovering ? "inherit" : "hidden",
          }}
          className="nodrag nopan"
        >
          <button
            className="remove-edge-btn"
            onClick={(event) => onEdgeClick(event, id)}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </EdgePathContainer>
  );
}

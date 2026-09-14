import React from 'react';
import { DragLine } from '../store/canvasStore';

export interface ConnectionLineProps {
  dragLine: DragLine | null;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({ dragLine }) => {
  if (!dragLine) return null;

  return (
    <svg
      className="mermaid-drag-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 999,
      }}
    >
      <line
        x1={dragLine.x1}
        y1={dragLine.y1}
        x2={dragLine.x2}
        y2={dragLine.y2}
        stroke="var(--mermaid-accent, var(--interactive-accent, #7c3aed))"
        strokeWidth={2.5}
        strokeDasharray="4 4"
      />
    </svg>
  );
};

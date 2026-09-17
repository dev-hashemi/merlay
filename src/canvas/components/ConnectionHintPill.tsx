import React from 'react';
import { CursorMode, Rect } from '../types';
import { LinkIcon } from '../icons/Icons';

export interface ConnectionHintPillProps {
  hoveredNodeRect: Rect | null;
  hoveredNodeId: string | null;
  hoveredNodeKind?: 'start' | 'end' | null;
  /** Tap-selected node fallback (touch has no hover). Ignored while multi-selecting. */
  selectedNodeRect?: Rect | null;
  selectedNodeId?: string | null;
  selectedNodeKind?: 'start' | 'end' | null;
  isLR: boolean;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  isConnecting: boolean;
  isEditing: boolean;
  isMultiSelect: boolean;
  isAnchor?: (id: string) => boolean;
}

export const ConnectionHintPill: React.FC<ConnectionHintPillProps> = ({
  hoveredNodeRect,
  hoveredNodeId,
  hoveredNodeKind,
  selectedNodeRect,
  selectedNodeId,
  selectedNodeKind,
  isLR,
  cursorMode,
  isSpacePressed,
  isConnecting,
  isEditing,
  isMultiSelect,
  isAnchor,
}) => {
  // Touch has no hover: fall back to the tap-selected node so finger users
  // still discover drag-to-connect.
  const showId = hoveredNodeId ?? (!isMultiSelect ? (selectedNodeId ?? null) : null);
  const showRect =
    hoveredNodeRect ?? (!isMultiSelect ? (selectedNodeRect ?? null) : null);
  const showKind = hoveredNodeId ? hoveredNodeKind : selectedNodeKind;

  if (
    !showRect ||
    !showId ||
    cursorMode === 'hand' ||
    isSpacePressed ||
    isConnecting ||
    isEditing ||
    isMultiSelect
  ) {
    return null;
  }

  // End anchors have no outgoing transitions in state diagrams
  if (isAnchor && isAnchor(showId) && showKind === 'end') {
    return null;
  }

  // Position above the node by default, or below if too close to the canvas top
  const isTooHigh = showRect.y < 34;
  const posX = showRect.x + showRect.width / 2;
  const posY = isTooHigh
    ? showRect.y + showRect.height + 8
    : showRect.y - 8;

  const transform = isTooHigh ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';

  return (
    <div
      className="mermaid-connect-hint-pill nodrag"
      style={{
        position: 'absolute',
        left: posX,
        top: posY,
        transform,
        zIndex: 120,
        pointerEvents: 'none',
      }}
    >
      <LinkIcon size={12} strokeWidth={2.2} />
      <span>Drag to connect</span>
    </div>
  );
};

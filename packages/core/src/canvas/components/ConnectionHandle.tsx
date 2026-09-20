import React from 'react';
import { CursorMode, Rect } from '../types';

export interface ConnectionHandleProps {
  hoveredNodeRect?: Rect | null;
  isLR?: boolean;
  cursorMode?: CursorMode;
  isSpacePressed?: boolean;
  hidden?: boolean;
  onStartConnect?: (e: React.MouseEvent, startX: number, startY: number) => void;
}

/**
 * @deprecated Permanent connection handles have been replaced by direct shape dragging
 * and the non-intrusive ConnectionHintPill.
 */
export const ConnectionHandle: React.FC<ConnectionHandleProps> = () => {
  return null;
};

import { App } from 'obsidian';
import { ArrowType } from '../diagrams/viewModel';

export type CursorMode = 'select' | 'hand';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MultiSelectBounds extends Rect {
  centerX: number;
  topY: number;
}

export interface SelectedEdgePos {
  x: number;
  y: number;
  label?: string;
  from: string;
  to: string;
  arrowType: ArrowType;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export type ActiveNodePopover = 'shape' | 'style' | 'subgraph' | null;
export type ActiveEdgePopover = 'style' | null;
export type ActiveMultiPopover = 'shape' | 'style' | 'edgeType' | null;

export interface PopoverPos {
  left: number;
  top: number;
  transform: string;
}

export interface NativeMermaidViewProps {
  app: App;
  initialCode: string;
  onCodeChange: (newCode: string) => void;
  onClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

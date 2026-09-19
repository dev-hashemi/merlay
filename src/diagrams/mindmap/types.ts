/**
 * Mermaid Mindmap AST Definitions and Node Types
 */

import { MermaidShapeType } from '../viewModel';

export type MindmapShape =
  | 'default'
  | 'circle'
  | 'rectangle'
  | 'rounded'
  | 'cloud'
  | 'bang'
  | 'hexagon';

export interface MindmapNode {
  id: string;
  label: string;
  shape: MindmapShape;
  parentId: string | null;
  children: string[];
  icon?: string;
  className?: string;
  explicitId?: string;
}

export interface RawMindmapLine {
  raw: string;
  order: number;
}

export interface MermaidMindmapAST {
  diagramType: 'mindmap';
  frontmatter?: string;
  root: MindmapNode | null;
  nodes: Map<string, MindmapNode>;
  rawLines: RawMindmapLine[];
}

export function mindmapShapeToViewModel(shape: MindmapShape): MermaidShapeType {
  switch (shape) {
    case 'circle':
      return 'circle';
    case 'rectangle':
      return 'rectangle';
    case 'rounded':
      return 'rounded';
    case 'hexagon':
      return 'hexagon';
    case 'cloud':
    case 'bang':
    case 'default':
    default:
      return 'rectangle';
  }
}

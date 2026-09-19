/**
 * Mermaid Flowchart AST Types & Interfaces
 *
 * Flowchart-specific AST definitions. The shared view-model types
 * (MermaidNodeDef, MermaidEdgeDef, MermaidSubgraphDef, shapes, arrows,
 * directions) live in src/diagrams/viewModel.ts and are re-exported here for
 * convenience within the flowchart package.
 */

import {
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidNodeDef,
  MermaidSubgraphDef,
} from '../viewModel';

export * from '../viewModel';

export interface MermaidStyleDef {
  type: 'style';
  targetId: string;
  styles: Record<string, string>;
}

export interface MermaidClassDef {
  type: 'classDef';
  name: string;
  styles: Record<string, string>;
}

export interface MermaidRawLine {
  type: 'raw';
  text: string;
}

export type ASTElement =
  | MermaidNodeDef
  | MermaidEdgeDef
  | MermaidSubgraphDef
  | MermaidStyleDef
  | MermaidClassDef
  | MermaidRawLine;

export interface MermaidFlowchartAST {
  diagramType: 'flowchart' | 'graph';
  /** Raw YAML lines between leading `--- ... ---` (without delimiters). */
  frontmatter?: string;
  direction: FlowchartDirection;
  nodes: Map<string, MermaidNodeDef>;
  edges: MermaidEdgeDef[];
  subgraphs: Map<string, MermaidSubgraphDef>;
  styles: MermaidStyleDef[];
  classDefs: Map<string, MermaidClassDef>;
  defaultLinkStyle?: Record<string, string>;
  rawLines: MermaidRawLine[];
}

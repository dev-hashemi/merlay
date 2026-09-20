/**
 * Shared Canvas View-Model
 *
 * The flowchart-shaped types below are the diagram-agnostic view-model every
 * driver projects its native AST onto (see DiagramDriver.project). The canvas
 * layer — overlays, HUDs, hit-testing, marquee — consumes only these types and
 * never a driver's native AST.
 *
 * The shapes/arrows vocabulary is flowchart-derived because mermaid's is, but
 * other diagrams map onto it: state diagrams render start/end anchors as
 * circles and choices as diamonds. `MermaidNodeDef.kind` carries the driver's
 * native node type alongside the mapped shape.
 *
 * The projection is read-only: mutations go through DiagramMutations, never
 * by editing these structures.
 */

export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

export type MermaidShapeType =
  | 'rectangle'          // [text]
  | 'rounded'            // (text)
  | 'stadium'            // ([text])
  | 'subroutine'         // [[text]]
  | 'cylinder'           // [(text)]
  | 'circle'             // ((text))
  | 'double_circle'      // (((text)))
  | 'diamond'            // {text}
  | 'hexagon'            // {{text}}
  | 'parallelogram'      // [/text/]
  | 'parallelogram_alt'  // [\text\]
  | 'trapezoid'          // [/text\]
  | 'trapezoid_alt'      // [\text/]
  | 'asymmetric';        // >text]

export type ArrowType =
  | 'arrow'          // -->
  | 'dotted'         // -.->
  | 'thick'          // ==>
  | 'open'           // ---
  | 'dotted_open'    // -.-
  | 'thick_open'     // ===
  | 'bidirectional'  // <-->
  | 'cross'          // --x
  | 'circle';        // --o

export interface MermaidNodeDef {
  type: 'node';
  id: string;
  label: string;
  shape: MermaidShapeType;
  /** Driver-specific node kind carried through the projection (e.g. stateType). */
  kind?: string;
  subgraphId?: string;
  style?: Record<string, string>;
  classes?: string[];
}

export interface MermaidEdgeDef {
  type: 'edge';
  id: string;
  from: string;
  to: string;
  arrowType: ArrowType;
  label?: string;
  style?: Record<string, string>;
}

export interface MermaidSubgraphDef {
  type: 'subgraph';
  id: string;
  label: string;
  direction?: FlowchartDirection;
  nodeIds: string[];
  subgraphIds: string[];
  style?: Record<string, string>;
}

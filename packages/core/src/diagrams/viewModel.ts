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
  // Classic delimiter shapes (original 14)
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
  | 'asymmetric'         // >text]
  // New @{ shape: } shapes (Mermaid v11.3+). The kind IS the short name.
  | 'odd'
  | 'datastore'
  | 'text'
  | 'notch-rect'
  | 'lin-rect'
  | 'sm-circ'
  | 'fr-circ'
  | 'fork'
  | 'hourglass'
  | 'brace'
  | 'brace-r'
  | 'braces'
  | 'bolt'
  | 'doc'
  | 'delay'
  | 'h-cyl'
  | 'lin-cyl'
  | 'curv-trap'
  | 'div-rect'
  | 'tri'
  | 'win-pane'
  | 'f-circ'
  | 'lin-doc'
  | 'notch-pent'
  | 'flip-tri'
  | 'sl-rect'
  | 'docs'
  | 'st-rect'
  | 'flag'
  | 'bow-rect'
  | 'cross-circ'
  | 'tag-doc'
  | 'tag-rect'
  | 'folder'
  | 'bucket'
  | 'console'
  | 'browser'
  | 'person'
  // Special shapes with extra params (icon:, img:)
  | 'icon'
  | 'image';

export type ArrowType =
  | 'arrow'                 // -->
  | 'dotted'                // -.->
  | 'thick'                 // ==>
  | 'open'                  // ---
  | 'dotted_open'           // -.-
  | 'thick_open'            // ===
  | 'bidirectional'         // <-->
  | 'cross'                 // --x
  | 'cross_bidirectional'   // x--x
  | 'circle'                // --o
  | 'circle_bidirectional'  // o--o
  | 'invisible';            // ~~~

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
  /**
   * Extra `@{ ... }` params for shapes that carry them (icon/img and any
   * future `@{ shape: x, key: value }` keys). Keys exclude `shape`/`label`.
   * Preserved verbatim so visual edits never drop hand-written params.
   */
  shapeParams?: Record<string, string>;
}

export interface MermaidEdgeDef {
  type: 'edge';
  id: string;
  from: string;
  to: string;
  arrowType: ArrowType;
  label?: string;
  style?: Record<string, string>;
  /** Visual/Dagre rank length (1 = default, 2 = long e.g. --->, 3 = extra long e.g. ---->) */
  length?: number;
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

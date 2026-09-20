/**
 * Mermaid State Diagram AST Types & Interfaces
 */

export type StateDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

export type MermaidStateType =
  | 'normal'
  | 'start'
  | 'end'
  | 'choice'
  | 'fork'
  | 'join';

export interface MermaidStateDef {
  type: 'state';
  id: string;
  label: string;
  stateType: MermaidStateType;
  description?: string;
  compositeId?: string;
  style?: Record<string, string>;
  classes?: string[];
  order?: number;
}

export interface MermaidTransitionDef {
  type: 'transition';
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: Record<string, string>;
  order?: number;
}

export interface MermaidCompositeStateDef {
  type: 'composite';
  id: string;
  label: string;
  direction?: StateDirection;
  stateIds: string[];
  compositeIds: string[];
  style?: Record<string, string>;
  order?: number;
}

export interface MermaidStateAST {
  diagramType: 'stateDiagram-v2' | 'stateDiagram';
  frontmatter?: string;
  direction?: StateDirection;
  states: Map<string, MermaidStateDef>;
  transitions: MermaidTransitionDef[];
  compositeStates: Map<string, MermaidCompositeStateDef>;
  styles: Array<{ targetId: string; styles: Record<string, string> }>;
  /**
   * Statements the editor does not model (notes, classDef/class, `--`
   * concurrency separators, `:::` styles, comments) preserved verbatim so
   * visual edits never corrupt or drop hand-written code.
   */
  rawLines: Array<{ text: string; compositeId?: string; order?: number }>;
}

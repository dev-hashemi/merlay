/**
 * Mermaid Sequence Diagram AST Types & Interfaces
 */

export type SequenceArrowType =
  | 'solid_arrow'   // ->>
  | 'dotted_arrow'  // -->>
  | 'solid_open'   // ->
  | 'dotted_open'  // -->
  | 'solid_cross'  // -x
  | 'dotted_cross' // --x
  | 'solid_async'  // -)
  | 'dotted_async';// --)

export type SequenceParticipantKind = 'participant' | 'actor';

export interface SequenceParticipantDef {
  type: 'participant';
  id: string;
  label: string;
  kind: SequenceParticipantKind;
  boxId?: string;
  order: number;
  explicit: boolean;
  style?: Record<string, string>;
}

export interface SequenceMessageDef {
  type: 'message';
  id: string;
  from: string;
  to: string;
  arrow: SequenceArrowType;
  label?: string;
  activateTarget?: boolean;   // +
  deactivateSender?: boolean; // -
  order: number;
}

export interface SequenceBoxDef {
  type: 'box';
  id: string;
  label: string;
  color?: string;
  participantIds: string[];
  order: number;
  wasQuoted?: boolean;
}

export interface SequenceRawItem {
  type: 'raw';
  text: string;
  boxId?: string;
  order: number;
}

export type SequenceTimelineItem =
  | { type: 'message'; message: SequenceMessageDef }
  | { type: 'raw'; text: string; boxId?: string };

export interface MermaidSequenceAST {
  diagramType: 'sequenceDiagram';
  frontmatter?: string;
  autonumber?: boolean;
  directives: string[];
  participants: Map<string, SequenceParticipantDef>;
  messages: SequenceMessageDef[];
  boxes: Map<string, SequenceBoxDef>;
  timeline: SequenceTimelineItem[];
  rawLines: Array<{ text: string; order?: number }>;
}

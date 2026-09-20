/**
 * Mermaid Class Diagram AST and Domain Types
 */

export type ClassDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type ClassKind = 'class' | 'interface' | 'abstract' | 'service' | 'enum' | string;

export interface ClassMember {
  raw: string;
  visibility?: '+' | '-' | '#' | '~';
  classifier?: '*' | '$';
  text: string;
}

export interface ClassNode {
  id: string;
  label: string;
  kind?: ClassKind;
  namespaceId?: string;
  members: ClassMember[];
  style?: Record<string, string>;
  classes?: string[];
  annotations?: string[];
}

export interface ClassRelationship {
  id: string;
  from: string;
  to: string;
  leftEnd?: string;
  lineType: '--' | '..';
  rightEnd?: string;
  leftCardinality?: string;
  rightCardinality?: string;
  label?: string;
  rawRelation: string;
}

export interface ClassNamespace {
  id: string;
  label: string;
  classIds: string[];
}

export interface ClassStyleDef {
  targetId: string;
  styles: Record<string, string>;
}

export interface RawLineEntry {
  raw: string;
  namespaceId?: string;
  order: number;
}

export interface MermaidClassAST {
  diagramType: 'classDiagram' | 'classDiagram-v2';
  frontmatter?: string;
  direction?: ClassDirection;
  classes: Map<string, ClassNode>;
  relationships: ClassRelationship[];
  namespaces: Map<string, ClassNamespace>;
  styles: ClassStyleDef[];
  rawLines: RawLineEntry[];
}

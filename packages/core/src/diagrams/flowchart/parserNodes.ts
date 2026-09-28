/**
 * Flowchart node parsing and AST node registration helpers.
 */

import { Token } from './lexer';
import { MermaidFlowchartAST, MermaidNodeDef, MermaidShapeType } from './types';
import { parseShapeMetaInner, resolveShapeAlias } from './shapes';

export interface FlowchartNodeInfo {
  id: string;
  label?: string;
  shape?: MermaidShapeType;
  shapeParams?: Record<string, string>;
  classes?: string[];
}

export function parseSingleNode(
  tokens: readonly Token[],
  cursor: number
): { node: FlowchartNodeInfo | null; nextCursor: number } {
  if (tokens[cursor]?.type !== 'IDENTIFIER') {
    return { node: null, nextCursor: cursor };
  }

  const id = tokens[cursor].value;
  let cur = cursor + 1;
  let label: string | undefined;
  let shape: MermaidShapeType | undefined;
  let shapeParams: Record<string, string> | undefined;
  const classes: string[] = [];

  if (tokens[cur]?.type === 'NODE_SHAPE') {
    label = tokens[cur].labelText;
    shape = tokens[cur].shapeType as MermaidShapeType;
    cur++;
  }

  // Mermaid v11.3+ `@{ ... }` metadata: `A@{ shape: docs, label: "X" }` or
  // appended after a classic shape `A["X"]@{ shape: docs }`. Meta wins.
  if (tokens[cur]?.type === 'SHAPE_META' && tokens[cur].metaInner !== undefined) {
    const meta = parseShapeMetaInner(tokens[cur].metaInner!);
    if (meta.shape) {
      if (meta.shape === 'icon') shape = 'icon';
      else if (meta.shape === 'image' || meta.shape === 'img') shape = 'image';
      else shape = resolveShapeAlias(meta.shape) ?? shape;
    } else if (meta.params.icon !== undefined) {
      shape = 'icon';
    } else if (meta.params.img !== undefined) {
      shape = 'image';
    }
    if (meta.label !== undefined && meta.label !== '') label = meta.label;
    if (Object.keys(meta.params).length > 0) shapeParams = { ...meta.params };
    cur++;
  }

  // Parse one or more :::className
  while (tokens[cur]?.type === 'CLASS_ASSIGN') {
    cur++; // consume ':::'
    if (tokens[cur]?.type === 'IDENTIFIER') {
      classes.push(tokens[cur].value);
      cur++;
    }
  }

  return {
    node: {
      id,
      label,
      shape,
      shapeParams,
      classes: classes.length > 0 ? classes : undefined,
    },
    nextCursor: cur,
  };
}

export function ensureNodeInAst(
  ast: MermaidFlowchartAST,
  currentSubId: string | undefined,
  nodeInfo: FlowchartNodeInfo
): void {
  if (!ast.nodes.has(nodeInfo.id)) {
    const newNode: MermaidNodeDef = {
      type: 'node',
      id: nodeInfo.id,
      label: nodeInfo.label || nodeInfo.id,
      shape: nodeInfo.shape || 'rectangle',
      subgraphId: currentSubId,
      classes: nodeInfo.classes ? [...nodeInfo.classes] : undefined,
      shapeParams: nodeInfo.shapeParams ? { ...nodeInfo.shapeParams } : undefined,
    };
    ast.nodes.set(nodeInfo.id, newNode);

    if (currentSubId && ast.subgraphs.has(currentSubId)) {
      const sub = ast.subgraphs.get(currentSubId)!;
      if (!sub.nodeIds.includes(nodeInfo.id)) {
        sub.nodeIds.push(nodeInfo.id);
      }
    }
  } else {
    // Update existing node with label/shape/classes if supplied
    const existing = ast.nodes.get(nodeInfo.id)!;
    if (nodeInfo.label) existing.label = nodeInfo.label;
    if (nodeInfo.shape) existing.shape = nodeInfo.shape;
    if (nodeInfo.shapeParams) {
      existing.shapeParams = { ...(existing.shapeParams ?? {}), ...nodeInfo.shapeParams };
    }
    if (nodeInfo.classes && nodeInfo.classes.length > 0) {
      existing.classes = Array.from(
        new Set([...(existing.classes || []), ...nodeInfo.classes])
      );
    }
    if (currentSubId && !existing.subgraphId) {
      existing.subgraphId = currentSubId;
      const sub = ast.subgraphs.get(currentSubId);
      if (sub && !sub.nodeIds.includes(nodeInfo.id)) {
        sub.nodeIds.push(nodeInfo.id);
      }
    }
  }
}

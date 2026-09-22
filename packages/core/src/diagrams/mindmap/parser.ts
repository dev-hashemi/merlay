/**
 * Tolerant Mermaid Mindmap Parser
 */

import { splitFrontmatter } from '../common/diagramHeader';
import { parseMindmapLine } from './lexer';
import { MermaidMindmapAST, MindmapNode } from './types';

export function createEmptyMindmapAst(): MermaidMindmapAST {
  return {
    diagramType: 'mindmap',
    frontmatter: undefined,
    root: null,
    nodes: new Map(),
    rawLines: [],
  };
}

export function parseMermaidMindmap(code: string): MermaidMindmapAST {
  const ast = createEmptyMindmapAst();
  const { frontmatter, body } = splitFrontmatter(code);
  ast.frontmatter = frontmatter;

  const lines = body.split(/\r?\n/);
  let inMindmap = false;
  let lineOrder = 0;
  let nodeCount = 0;
  let lastCreatedNode: MindmapNode | null = null;

  // Stack of active ancestor nodes: [ { id, indent } ]
  const stack: { id: string; indent: number }[] = [];

  for (const line of lines) {
    lineOrder++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check diagram declaration
    if (!inMindmap) {
      if (/^mindmap\b/i.test(trimmed)) {
        inMindmap = true;
        continue;
      }
      if (trimmed.startsWith('%%') || /^acc(Title|Descr)\b/i.test(trimmed)) {
        ast.rawLines.push({ raw: trimmed, order: lineOrder });
        continue;
      }
      // If code starts without "mindmap" keyword, still try to parse as mindmap
      inMindmap = true;
    }

    const token = parseMindmapLine(line);
    if (!token) continue;

    if (token.type === 'raw') {
      ast.rawLines.push({ raw: token.raw, order: lineOrder });
      continue;
    }

    if (token.type === 'icon') {
      if (lastCreatedNode && token.icon) {
        lastCreatedNode.icon = token.icon;
      }
      continue;
    }

    if (token.type === 'class') {
      if (lastCreatedNode && token.className) {
        lastCreatedNode.className = token.className;
      }
      continue;
    }

    if (token.type === 'node') {
      // Determine unique ID for the node
      const suggestedId = token.explicitId || `node_${nodeCount++}`;
      let finalId = suggestedId;
      let collisionIdx = 1;
      while (ast.nodes.has(finalId)) {
        finalId = `${suggestedId}_${collisionIdx++}`;
      }

      const newNode: MindmapNode = {
        id: finalId,
        label: token.label ?? '',
        shape: token.shape || 'default',
        parentId: null,
        children: [],
        icon: token.icon,
        className: token.className,
        explicitId: token.explicitId,
      };

      if (ast.root === null) {
        // First node is the root
        ast.root = newNode;
        newNode.parentId = null;
        stack.push({ id: newNode.id, indent: token.indent });
      } else {
        // Pop nodes that are at the same or deeper indentation level
        while (stack.length > 0 && stack[stack.length - 1].indent >= token.indent) {
          stack.pop();
        }

        // Parent is the nearest node on the stack with smaller indentation
        const parentId = stack.length > 0 ? stack[stack.length - 1].id : ast.root.id;
        const parentNode = ast.nodes.get(parentId) || ast.root;

        newNode.parentId = parentNode.id;
        parentNode.children.push(newNode.id);
        stack.push({ id: newNode.id, indent: token.indent });
      }

      ast.nodes.set(newNode.id, newNode);
      lastCreatedNode = newNode;
    }
  }

  return ast;
}

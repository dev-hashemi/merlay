/**
 * Mermaid Mindmap Serializer
 */

import { emitFrontmatter } from '../common/diagramHeader';
import { MermaidMindmapAST, MindmapNode, MindmapShape } from './types';

/**
 * Format a label safely for mindmap syntax.
 * Quotes the label if it contains special delimiters.
 */
function formatLabel(label: string): string {
  if (!label) return 'Topic';
  const isAlreadyQuoted =
    label.startsWith('"') && label.endsWith('"') && label.length >= 2;
  if (/[[\](){}:"]/.test(label) && !isAlreadyQuoted) {
    return `"${label.replace(/"/g, '\\"')}"`;
  }
  return label;
}

/**
 * Emits the node definition with its shape delimiters.
 */
function serializeNodeContent(node: MindmapNode): string {
  const label = formatLabel(node.label);
  const idPrefix = node.explicitId ? `${node.explicitId}` : '';
  const classSuffix = node.className ? `:::${node.className}` : '';

  let body = '';
  switch (node.shape) {
    case 'circle':
      body = `${idPrefix}((${label}))`;
      break;
    case 'rectangle':
      body = `${idPrefix}[${label}]`;
      break;
    case 'rounded':
      body = `${idPrefix}(${label})`;
      break;
    case 'cloud':
      body = `${idPrefix})${label}(`;
      break;
    case 'bang':
      body = `${idPrefix}))${label}((`
      break;
    case 'hexagon':
      body = `${idPrefix}{{${label}}}`;
      break;
    case 'default':
    default:
      if (node.explicitId) {
        body = `${node.explicitId}[${label}]`;
      } else {
        body = label;
      }
      break;
  }

  return `${body}${classSuffix}`;
}

export function serializeMermaidMindmap(ast: MermaidMindmapAST): string {
  const lines: string[] = [];
  emitFrontmatter(lines, ast.frontmatter);

  lines.push('mindmap');

  // Diagram-level raw lines (comments, directives)
  for (const raw of ast.rawLines) {
    lines.push(`  ${raw.raw}`);
  }

  if (!ast.root) {
    return lines.join('\n') + '\n';
  }

  function emitSubtree(nodeId: string, depth: number) {
    const node = ast.nodes.get(nodeId);
    if (!node) return;

    const indent = '  '.repeat(depth + 1);
    lines.push(`${indent}${serializeNodeContent(node)}`);

    if (node.icon) {
      lines.push(`${indent}  ::icon(${node.icon})`);
    }

    for (const childId of node.children) {
      emitSubtree(childId, depth + 1);
    }
  }

  emitSubtree(ast.root.id, 0);

  return lines.join('\n') + '\n';
}

/**
 * Serializer: Converts MermaidFlowchartAST to clean, normalized Mermaid text
 */

import {
  ArrowType,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from './types';
import { isClassicShape, shortNameFor } from './shapes';
import { emitFrontmatter, emitDirectives } from '../common/diagramHeader';

export function serializeMermaidFlowchart(ast: MermaidFlowchartAST): string {
  const lines: string[] = [];

  // 0. Frontmatter (shared YAML block, same as state/sequence diagrams)
  emitFrontmatter(lines, ast.frontmatter);

  // 0b. Directives (e.g. %%{init: ...}%%)
  emitDirectives(lines, ast.directives);

  // 1. Header
  lines.push(`${ast.diagramType || 'flowchart'} ${ast.direction || 'TD'}`);

  const emittedNodeIds = new Set<string>();

  // 2. Subgraphs. Only top-level groups are emitted here; nested groups
  // recurse through subgraphIds so the hierarchy survives the round-trip.
  const childSubIds = new Set<string>();
  for (const subDef of ast.subgraphs.values()) {
    for (const childId of subDef.subgraphIds ?? []) childSubIds.add(childId);
  }

  const emittedSubIds = new Set<string>();
  const emitSubgraph = (subId: string, indent: string): void => {
    const subDef = ast.subgraphs.get(subId);
    // emittedSubIds doubles as a cycle guard: a corrupt AST must never
    // hang the serializer in infinite recursion.
    if (!subDef || emittedSubIds.has(subId)) return;
    emittedSubIds.add(subId);

    const labelPart = subDef.label ? ` ["${escapeLabel(subDef.label)}"]` : '';
    lines.push(`${indent}subgraph ${subId}${labelPart}`);

    const inner = indent + '    ';
    if (subDef.direction) {
      lines.push(`${inner}direction ${subDef.direction}`);
    }

    for (const nodeId of subDef.nodeIds) {
      const node = ast.nodes.get(nodeId);
      if (node) {
        lines.push(`${inner}${formatNode(node)}`);
        emittedNodeIds.add(node.id);
      }
    }

    for (const childId of subDef.subgraphIds ?? []) {
      emitSubgraph(childId, inner);
    }

    lines.push(`${indent}end\n`);
  };

  for (const [subId] of ast.subgraphs.entries()) {
    if (!childSubIds.has(subId)) emitSubgraph(subId, '    ');
  }
  // Orphaned references and defensive leftovers emit flat so no group
  // silently vanishes from the output.
  for (const [subId] of ast.subgraphs.entries()) {
    if (!emittedSubIds.has(subId)) emitSubgraph(subId, '    ');
  }

  // 3. Standalone nodes (not part of any subgraph, or not yet defined with custom label)
  for (const [nodeId, node] of ast.nodes.entries()) {
    if (!node.subgraphId && !emittedNodeIds.has(nodeId) && !ast.subgraphs.has(nodeId)) {
      lines.push(`    ${formatNode(node)}`);
      emittedNodeIds.add(nodeId);
    }
  }

  if (lines.length > 1 && ast.edges.length > 0) {
    lines.push('');
  }

  // 4. Edges
  for (const edge of ast.edges) {
    const arrowStr = formatArrow(edge.arrowType, edge.label, edge.length);
    lines.push(`    ${edge.from} ${arrowStr} ${edge.to}`);
  }

  // 5. ClassDefs
  if (ast.classDefs.size > 0) {
    lines.push('');
    for (const [name, def] of ast.classDefs.entries()) {
      const stylePairs = Object.entries(def.styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      lines.push(`    classDef ${name} ${stylePairs}`);
    }
  }

  // 5b. Class assignments
  const classToNodes = new Map<string, string[]>();
  for (const node of ast.nodes.values()) {
    if (node.classes && node.classes.length > 0) {
      for (const cls of node.classes) {
        if (!classToNodes.has(cls)) {
          classToNodes.set(cls, []);
        }
        classToNodes.get(cls)!.push(node.id);
      }
    }
  }

  if (classToNodes.size > 0) {
    lines.push('');
    for (const [cls, nodeIds] of classToNodes.entries()) {
      lines.push(`    class ${nodeIds.join(',')} ${cls}`);
    }
  }

  // 6. Style statements
  if (ast.styles.length > 0) {
    const mergedStyles = new Map<string, Record<string, string>>();
    for (const style of ast.styles) {
      const current = mergedStyles.get(style.targetId) || {};
      mergedStyles.set(style.targetId, { ...current, ...style.styles });
    }

    lines.push('');
    for (const [targetId, styles] of mergedStyles.entries()) {
      const stylePairs = Object.entries(styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      lines.push(`    style ${targetId} ${stylePairs}`);
    }
  }

  // 7. LinkStyle statements
  let hasLinkStyles = false;
  if (ast.defaultLinkStyle && Object.keys(ast.defaultLinkStyle).length > 0) {
    lines.push('');
    hasLinkStyles = true;
    const stylePairs = Object.entries(ast.defaultLinkStyle)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    lines.push(`    linkStyle default ${stylePairs}`);
  }

  for (let i = 0; i < ast.edges.length; i++) {
    const edge = ast.edges[i];
    if (edge.style && Object.keys(edge.style).length > 0) {
      if (
        ast.defaultLinkStyle &&
        Object.keys(edge.style).length === Object.keys(ast.defaultLinkStyle).length &&
        Object.entries(edge.style).every(([k, v]) => ast.defaultLinkStyle?.[k] === v)
      ) {
        continue;
      }
      if (!hasLinkStyles) {
        lines.push('');
        hasLinkStyles = true;
      }
      const stylePairs = Object.entries(edge.style)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      lines.push(`    linkStyle ${i} ${stylePairs}`);
    }
  }

  // 8. Preserved statements (click, accTitle/accDescr, comments) — emitted
  // verbatim so visual edits never corrupt or drop hand-written code.
  if (ast.rawLines.length > 0) {
    lines.push('');
    for (const raw of ast.rawLines) {
      lines.push(`    ${raw.text}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Format a full node definition. Classic shapes use delimiters
 * (`A["x"]`); v11.3+ shapes use `A@{ shape: docs, label: "x" }`;
 * icon/image shapes emit their preserved params.
 */
function formatNode(node: MermaidNodeDef): string {
  if (isClassicShape(node.shape)) {
    return `${node.id}${formatShape(node.shape, node.label)}`;
  }
  const safe = `"${escapeLabel(node.label)}"`;
  const extra = node.shapeParams
    ? Object.entries(node.shapeParams)
        .map(([k, v]) => `, ${k}: "${escapeLabel(v)}"`)
        .join('')
    : '';
  if (node.shape === 'icon' || node.shape === 'image') {
    // Icon/image params (icon:/img:) live in shapeParams; no `shape:` key.
    const params = node.shapeParams
      ? Object.entries(node.shapeParams)
          .map(([k, v]) => `${k}: "${escapeLabel(v)}"`)
          .join(', ')
      : '';
    const labelPart = `, label: ${safe}`;
    return params
      ? `${node.id}@{ ${params}${labelPart} }`
      : `${node.id}@{ label: ${safe} }`;
  }
  return `${node.id}@{ shape: ${shortNameFor(node.shape)}, label: ${safe}${extra} }`;
}

function formatShape(shape: MermaidShapeType, label: string): string {
  const safe = `"${escapeLabel(label)}"`;
  switch (shape) {
    case 'rounded':
      return `(${safe})`;
    case 'stadium':
      return `([${safe}])`;
    case 'subroutine':
      return `[[${safe}]]`;
    case 'cylinder':
      return `[(${safe})]`;
    case 'circle':
      return `((${safe}))`;
    case 'double_circle':
      return `(((${safe})))`;
    case 'diamond':
      return `{${safe}}`;
    case 'hexagon':
      return `{{${safe}}}`;
    case 'parallelogram':
      return `[/${safe}/]`;
    case 'parallelogram_alt':
      return `[\\${safe}\\]`;
    case 'trapezoid':
      return `[/${safe}\\]`;
    case 'trapezoid_alt':
      return `[\\${safe}/]`;
    case 'asymmetric':
      return `>${safe}]`;
    case 'rectangle':
    default:
      return `[${safe}]`;
  }
}

function formatArrow(type: ArrowType, label?: string, length?: number): string {
  const len = Math.max(1, length || 1);
  const labelPart = label ? `|${escapeLabel(label)}|` : '';
  let base = '';

  switch (type) {
    case 'invisible':
      base = '~'.repeat(2 + len);
      break;
    case 'dotted':
      base = `-${'.'.repeat(len)}->`;
      break;
    case 'dotted_open':
      base = `-${'.'.repeat(len)}-`;
      break;
    case 'thick':
      base = `${'='.repeat(1 + len)}>`;
      break;
    case 'thick_open':
      base = '='.repeat(2 + len);
      break;
    case 'bidirectional':
      base = `<${'-'.repeat(1 + len)}>`;
      break;
    case 'circle':
      base = `${'-'.repeat(1 + len)}o`;
      break;
    case 'circle_bidirectional':
      base = `o${'-'.repeat(1 + len)}o`;
      break;
    case 'cross':
      base = `${'-'.repeat(1 + len)}x`;
      break;
    case 'cross_bidirectional':
      base = `x${'-'.repeat(1 + len)}x`;
      break;
    case 'open':
      base = '-'.repeat(2 + len);
      break;
    case 'arrow':
    default:
      base = `${'-'.repeat(1 + len)}>`;
      break;
  }

  return labelPart ? `${base}${labelPart}` : base;
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '#quot;');
}

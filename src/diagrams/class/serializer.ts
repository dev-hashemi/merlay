/**
 * Mermaid Class Diagram Clean Serializer
 */

import { emitFrontmatter } from '../common/diagramHeader';
import { ClassNode, MermaidClassAST } from './types';

function formatStyleProperties(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

function serializeClassBlock(cls: ClassNode, indent = '    '): string[] {
  const lines: string[] = [];
  const hasMembers = cls.members && cls.members.length > 0;
  const hasAnnotations = cls.annotations && cls.annotations.length > 0;
  const hasCustomLabel = cls.label && cls.label !== cls.id;
  const styleSuffix = cls.classes && cls.classes.length > 0 ? `:::${cls.classes[0]}` : '';

  if (hasMembers || hasAnnotations) {
    const labelPart = hasCustomLabel ? `["${cls.label}"]` : '';
    lines.push(`${indent}class ${cls.id}${labelPart}${styleSuffix} {`);
    if (cls.annotations) {
      for (const ann of cls.annotations) {
        lines.push(`${indent}    <<${ann}>>`);
      }
    }
    for (const m of cls.members) {
      lines.push(`${indent}    ${m.raw}`);
    }
    lines.push(`${indent}}`);
  } else if (hasCustomLabel) {
    lines.push(`${indent}class ${cls.id}["${cls.label}"]${styleSuffix}`);
  } else if (styleSuffix) {
    lines.push(`${indent}class ${cls.id}${styleSuffix}`);
  } else {
    lines.push(`${indent}class ${cls.id}`);
  }

  return lines;
}

export function serializeMermaidClassDiagram(ast: MermaidClassAST): string {
  const lines: string[] = [];

  // 1. YAML Frontmatter
  emitFrontmatter(lines, ast.frontmatter);

  // 2. Header
  lines.push(ast.diagramType || 'classDiagram');

  // 3. Direction
  if (ast.direction) {
    lines.push(`    direction ${ast.direction}`);
  }

  // 4. Diagram-level raw lines (e.g. comments, accTitle)
  const topRawLines = ast.rawLines.filter((r) => !r.namespaceId);
  for (const raw of topRawLines) {
    lines.push(`    ${raw.raw}`);
  }

  // Set of classes serialized inside namespaces
  const serializedClasses = new Set<string>();

  // 5. Namespaces
  for (const [nsId, ns] of ast.namespaces.entries()) {
    // Empty namespace safeguard: Mermaid throws syntax error on empty braces!
    const memberClasses = ns.classIds
      .map((id) => ast.classes.get(id))
      .filter((c): c is ClassNode => !!c);

    if (memberClasses.length === 0) {
      // If namespace has no members, skip emitting empty braces
      continue;
    }

    lines.push(`    namespace ${nsId} {`);
    for (const cls of memberClasses) {
      serializedClasses.add(cls.id);
      lines.push(...serializeClassBlock(cls, '        '));
    }

    // Scoped raw lines for this namespace
    const scopedRaw = ast.rawLines.filter((r) => r.namespaceId === nsId);
    for (const raw of scopedRaw) {
      lines.push(`        ${raw.raw}`);
    }

    lines.push('    }');
  }

  // 6. Top-level classes
  for (const [id, cls] of ast.classes.entries()) {
    if (!serializedClasses.has(id)) {
      lines.push(...serializeClassBlock(cls, '    '));
    }
  }

  // 7. Relationships
  for (const rel of ast.relationships) {
    const leftCard = rel.leftCardinality ? `"${rel.leftCardinality}" ` : '';
    const token = rel.rawRelation || `${rel.leftEnd || ''}${rel.lineType || '--'}${rel.rightEnd || ''}`;
    const rightCard = rel.rightCardinality ? ` "${rel.rightCardinality}"` : '';
    const labelPart = rel.label ? ` : ${rel.label}` : '';
    lines.push(`    ${rel.from} ${leftCard}${token}${rightCard} ${rel.to}${labelPart}`);
  }

  // 8. Styles
  for (const st of ast.styles) {
    if (st.styles && Object.keys(st.styles).length > 0) {
      lines.push(`    style ${st.targetId} ${formatStyleProperties(st.styles)};`);
    }
  }

  return lines.join('\n') + '\n';
}

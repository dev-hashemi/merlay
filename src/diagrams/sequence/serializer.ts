/**
 * Serializer: Converts MermaidSequenceAST into clean, normalized Mermaid sequenceDiagram syntax
 */

import {
  MermaidSequenceAST,
  SequenceArrowType,
  SequenceParticipantDef,
} from './types';
import { emitFrontmatter } from '../common/diagramHeader';

export function arrowToToken(arrow: SequenceArrowType): string {
  switch (arrow) {
    case 'solid_arrow':
      return '->>';
    case 'dotted_arrow':
      return '-->>';
    case 'solid_open':
      return '->';
    case 'dotted_open':
      return '-->';
    case 'solid_cross':
      return '-x';
    case 'dotted_cross':
      return '--x';
    case 'solid_async':
      return '-)';
    case 'dotted_async':
      return '--)';
    default:
      return '->>';
  }
}

export function escapeParticipantId(id: string): string {
  if (id.includes(' ') || /[^a-zA-Z0-9_\-.]/.test(id)) {
    const stripped = id.replace(/^["']|["']$/g, '').replace(/\\"/g, '"');
    return `"${stripped}"`;
  }
  return id;
}

export function formatParticipant(p: SequenceParticipantDef): string {
  const keyword = p.kind === 'actor' ? 'actor' : 'participant';
  if (p.label && p.label !== p.id) {
    // In Mermaid sequence diagrams, the description after "as " is verbatim text.
    // It must not be artificially wrapped in quotes or backslash-escaped.
    return `${keyword} ${escapeParticipantId(p.id)} as ${p.label}`;
  }
  return `${keyword} ${escapeParticipantId(p.id)}`;
}

function escapeBoxLabel(label: string, wasQuoted?: boolean): string {
  if (!label) return '';
  if (wasQuoted) {
    return `"${label.replace(/"/g, '\\"')}"`;
  }
  return label;
}

export function serializeMermaidSequenceDiagram(ast: MermaidSequenceAST): string {
  const lines: string[] = [];

  // 1. Frontmatter (shared YAML block, same as every diagram kind)
  emitFrontmatter(lines, ast.frontmatter);

  // 2. Header
  lines.push('sequenceDiagram');

  // 3. Autonumber
  if (ast.autonumber) {
    lines.push('    autonumber');
  }

  // 4. Directives (accTitle, accDescr, %%{init: ...}%%)
  if (ast.directives && ast.directives.length > 0) {
    for (const d of ast.directives) {
      lines.push(`    ${d.trim()}`);
    }
  }

  // 5. Boxes and Participant Declarations
  const emittedParticipants = new Set<string>();

  for (const box of ast.boxes.values()) {
    const colorPart = box.color ? ` ${box.color}` : '';
    const labelPart = box.label ? ` ${escapeBoxLabel(box.label, box.wasQuoted)}` : '';
    lines.push(`    box${colorPart}${labelPart}`);
    for (const pid of box.participantIds) {
      const p = ast.participants.get(pid);
      if (p) {
        lines.push(`        ${formatParticipant(p)}`);
        emittedParticipants.add(pid);
      }
    }
    lines.push('    end');
  }

  // Explicit top-level participants (or actors, or participants with custom labels)
  for (const p of ast.participants.values()) {
    if (emittedParticipants.has(p.id)) continue;
    if (p.explicit || p.kind === 'actor' || (p.label && p.label !== p.id)) {
      lines.push(`    ${formatParticipant(p)}`);
      emittedParticipants.add(p.id);
    }
  }

  // 6. Timeline Items (Messages, Notes, Control Blocks, Activations, Comments)
  let blockDepth = 0;

  for (const item of ast.timeline) {
    if (item.type === 'message') {
      const m = item.message;
      // Skip if either endpoint was deleted
      if (!ast.participants.has(m.from) || !ast.participants.has(m.to)) {
        continue;
      }
      const arrowToken = arrowToToken(m.arrow);
      const targetAct = m.activateTarget ? '+' : '';
      const senderDeact = m.deactivateSender ? '-' : '';
      const arrowWithAct = `${arrowToken}${targetAct}${senderDeact}`;
      const labelPart = m.label ? `: ${m.label}` : '';
      const indent = '    ' + '    '.repeat(blockDepth);
      lines.push(
        `${indent}${escapeParticipantId(m.from)}${arrowWithAct}${escapeParticipantId(m.to)}${labelPart}`
      );
    } else if (item.type === 'raw') {
      const text = item.text.trim();
      if (/^end\b/i.test(text)) {
        blockDepth = Math.max(0, blockDepth - 1);
        const indent = '    ' + '    '.repeat(blockDepth);
        lines.push(`${indent}${text}`);
      } else if (/^(else|and|option)\b/i.test(text)) {
        const parentDepth = Math.max(0, blockDepth - 1);
        const indent = '    ' + '    '.repeat(parentDepth);
        lines.push(`${indent}${text}`);
      } else if (/^(loop|alt|opt|par|critical|break|rect)\b/i.test(text)) {
        const indent = '    ' + '    '.repeat(blockDepth);
        lines.push(`${indent}${text}`);
        blockDepth++;
      } else {
        const indent = '    ' + '    '.repeat(blockDepth);
        lines.push(`${indent}${text}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

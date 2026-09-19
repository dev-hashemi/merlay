/**
 * Tolerant AST Parser for Mermaid Sequence Diagrams
 */

import { tokenizeSequenceDiagram } from './lexer';
import { splitFrontmatter } from '../common/diagramHeader';
import {
  MermaidSequenceAST,
  SequenceBoxDef,
  SequenceMessageDef,
  SequenceParticipantDef,
} from './types';

export function parseMermaidSequenceDiagram(input: string): MermaidSequenceAST {
  const { frontmatter, body } = splitFrontmatter(input);
  const tokens = tokenizeSequenceDiagram(body);

  const ast: MermaidSequenceAST = {
    diagramType: 'sequenceDiagram',
    frontmatter,
    directives: [],
    participants: new Map(),
    messages: [],
    boxes: new Map(),
    timeline: [],
    rawLines: [],
  };

  let currentBoxId: string | null = null;
  let order = 0;
  let msgCounter = 0;
  let boxCounter = 0;
  let participantOrder = 0;

  for (const token of tokens) {
    if (token.type === 'EOF') break;

    switch (token.type) {

      case 'HEADER':
        ast.diagramType = 'sequenceDiagram';
        break;

      case 'AUTONUMBER':
        ast.autonumber = true;
        break;

      case 'DIRECTIVE':
        ast.directives.push(token.value);
        ast.rawLines.push({ text: token.value, order: order++ });
        break;

      case 'COMMENT':
        ast.timeline.push({
          type: 'raw',
          text: token.value,
          boxId: currentBoxId || undefined,
        });
        ast.rawLines.push({ text: token.value, order: order++ });
        break;

      case 'BOX_START': {
        const boxId = `box_${++boxCounter}`;
        currentBoxId = boxId;
        const boxDef: SequenceBoxDef = {
          type: 'box',
          id: boxId,
          label: token.box?.label || '',
          color: token.box?.color,
          participantIds: [],
          order: order++,
          wasQuoted: token.box?.wasQuoted,
        };
        ast.boxes.set(boxId, boxDef);
        break;
      }

      case 'BOX_END':
        currentBoxId = null;
        break;

      case 'PARTICIPANT': {
        const p = token.participant!;
        const existing = ast.participants.get(p.id);
        if (!existing) {
          const def: SequenceParticipantDef = {
            type: 'participant',
            id: p.id,
            label: p.label || p.id,
            kind: p.kind,
            boxId: currentBoxId || undefined,
            order: participantOrder++,
            explicit: true,
          };
          ast.participants.set(p.id, def);
          if (currentBoxId && ast.boxes.has(currentBoxId)) {
            ast.boxes.get(currentBoxId)!.participantIds.push(p.id);
          }
        } else {
          existing.label = p.label || existing.label;
          existing.kind = p.kind;
          existing.explicit = true;
          if (currentBoxId && !existing.boxId && ast.boxes.has(currentBoxId)) {
            existing.boxId = currentBoxId;
            ast.boxes.get(currentBoxId)!.participantIds.push(p.id);
          }
        }
        break;
      }

      case 'MESSAGE': {
        const m = token.message!;
        // Ensure from and to participants are registered (implicit if not declared)
        if (!ast.participants.has(m.from)) {
          ast.participants.set(m.from, {
            type: 'participant',
            id: m.from,
            label: m.from,
            kind: 'participant',
            order: participantOrder++,
            explicit: false,
          });
        }
        if (!ast.participants.has(m.to)) {
          ast.participants.set(m.to, {
            type: 'participant',
            id: m.to,
            label: m.to,
            kind: 'participant',
            order: participantOrder++,
            explicit: false,
          });
        }

        const msgDef: SequenceMessageDef = {
          type: 'message',
          id: `msg_${++msgCounter}_${m.from}_${m.to}`,
          from: m.from,
          to: m.to,
          arrow: m.arrow,
          label: m.label,
          activateTarget: m.activateTarget,
          deactivateSender: m.deactivateSender,
          order: order++,
        };

        ast.messages.push(msgDef);
        ast.timeline.push({ type: 'message', message: msgDef });
        break;
      }

      case 'RAW_LINE':
        ast.timeline.push({
          type: 'raw',
          text: token.value,
          boxId: currentBoxId || undefined,
        });
        ast.rawLines.push({ text: token.value, order: order++ });
        break;
    }
  }

  return ast;
}

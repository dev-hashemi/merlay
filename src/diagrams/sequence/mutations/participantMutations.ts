/**
 * Participant mutations for Mermaid Sequence Diagrams
 */

import {
  MermaidSequenceAST,
  SequenceParticipantDef,
  SequenceParticipantKind,
} from '../types';
import { generateUniqueId } from '../../common/diagramHeader';
import { connectParticipants } from './messageMutations';

export function generateParticipantId(prefix = 'p', ast?: MermaidSequenceAST): string {
  const existing = new Set<string>();
  if (ast) {
    for (const id of ast.participants.keys()) existing.add(id);
    for (const id of ast.boxes.keys()) existing.add(id);
  }
  return generateUniqueId(existing, prefix);
}

export function addParticipant(
  ast: MermaidSequenceAST,
  label = 'New Participant',
  kind: SequenceParticipantKind = 'participant',
  boxId?: string
): string {
  const id = generateParticipantId('p', ast);
  const newPart: SequenceParticipantDef = {
    type: 'participant',
    id,
    label: label || id,
    kind,
    boxId,
    order: ast.participants.size,
    explicit: true,
  };

  ast.participants.set(id, newPart);

  if (boxId && ast.boxes.has(boxId)) {
    ast.boxes.get(boxId)!.participantIds.push(id);
  }

  return id;
}

export function addChildParticipant(
  ast: MermaidSequenceAST,
  parentId: string,
  label = 'Next Participant',
  messageLabel?: string
): string {
  const isExplicitNewParticipant =
    label &&
    label !== 'Next Participant' &&
    label !== 'Next Message' &&
    label !== 'Participant 2';

  // If the caller explicitly requested a specific new participant name (e.g. programmatic / test)
  if (isExplicitNewParticipant) {
    const parent = ast.participants.get(parentId);
    const boxId = parent?.boxId;
    const childId = addParticipant(ast, label, 'participant', boxId);
    connectParticipants(ast, parentId, childId, messageLabel || 'Message');
    return childId;
  }

  // If other participants already exist, UI sprout adds a message down the timeline to them
  const otherParticipants = Array.from(ast.participants.keys()).filter((id) => id !== parentId);
  if (otherParticipants.length > 0) {
    const partKeys = Array.from(ast.participants.keys());
    const parentIdx = partKeys.indexOf(parentId);
    let targetId = otherParticipants[0];
    for (let i = parentIdx + 1; i < partKeys.length; i++) {
      if (partKeys[i] !== parentId) {
        targetId = partKeys[i];
        break;
      }
    }
    const msgLabel =
      messageLabel && messageLabel !== 'Next Message' && messageLabel !== 'Next Participant'
        ? messageLabel
        : 'Message';
    connectParticipants(ast, parentId, targetId, msgLabel);
    return targetId;
  }

  // Fallback: If parentId is the only participant in the diagram, create a partner participant and connect
  const parent = ast.participants.get(parentId);
  const boxId = parent?.boxId;
  const childId = addParticipant(ast, 'Participant 2', 'participant', boxId);

  connectParticipants(ast, parentId, childId, messageLabel || 'Message');
  return childId;
}

export function deleteParticipant(
  ast: MermaidSequenceAST,
  participantId: string
): void {
  const part = ast.participants.get(participantId);
  if (!part) return;

  // 1. Remove from box if in one
  if (part.boxId && ast.boxes.has(part.boxId)) {
    const box = ast.boxes.get(part.boxId)!;
    box.participantIds = box.participantIds.filter((id) => id !== participantId);
  }

  // 2. Cascade delete incident messages
  ast.messages = ast.messages.filter(
    (m) => m.from !== participantId && m.to !== participantId
  );

  ast.timeline = ast.timeline.filter((item) => {
    if (item.type === 'message') {
      return item.message.from !== participantId && item.message.to !== participantId;
    }
    return true;
  });

  // 3. Remove participant
  ast.participants.delete(participantId);
}

export function deleteParticipants(
  ast: MermaidSequenceAST,
  participantIds: Iterable<string>
): void {
  for (const id of participantIds) {
    deleteParticipant(ast, id);
  }
}

export function updateParticipantLabel(
  ast: MermaidSequenceAST,
  participantId: string,
  label: string
): void {
  const part = ast.participants.get(participantId);
  if (part) {
    part.label = label;
    part.explicit = true;
  }
}

export function isParticipantTextEditable(
  part?: SequenceParticipantDef
): boolean {
  return !!part;
}

export function updateParticipantKind(
  ast: MermaidSequenceAST,
  participantId: string,
  kind: SequenceParticipantKind
): void {
  const part = ast.participants.get(participantId);
  if (part) {
    part.kind = kind;
    part.explicit = true;
  }
}

export function getParticipantStyle(
  ast: MermaidSequenceAST,
  participantId: string
): Record<string, string> | undefined {
  return ast.participants.get(participantId)?.style;
}

export function updateParticipantStyle(
  ast: MermaidSequenceAST,
  participantId: string,
  styles: Record<string, string>
): void {
  const part = ast.participants.get(participantId);
  if (part) {
    part.style = { ...part.style, ...styles };
  }
}

export function updateParticipantsStyle(
  ast: MermaidSequenceAST,
  participantIds: Iterable<string>,
  styles: Record<string, string>
): void {
  for (const id of participantIds) {
    updateParticipantStyle(ast, id, styles);
  }
}

export function clearParticipantStyle(
  ast: MermaidSequenceAST,
  participantId: string
): void {
  const part = ast.participants.get(participantId);
  if (part) {
    part.style = undefined;
  }
}

export function clearParticipantsStyle(
  ast: MermaidSequenceAST,
  participantIds: Iterable<string>
): void {
  for (const id of participantIds) {
    clearParticipantStyle(ast, id);
  }
}

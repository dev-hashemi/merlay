/**
 * Box (Grouping) mutations for Mermaid Sequence Diagrams
 */

import { MermaidSequenceAST, SequenceBoxDef } from '../types';
import { deleteParticipant } from './participantMutations';

export function generateBoxId(ast?: MermaidSequenceAST): string {
  const count = (ast ? ast.boxes.size : 0) + 1;
  return `box_${count}`;
}

export function createBox(
  ast: MermaidSequenceAST,
  label = 'New Box',
  color?: string
): string {
  const id = generateBoxId(ast);
  const box: SequenceBoxDef = {
    type: 'box',
    id,
    label,
    color,
    participantIds: [],
    order: ast.boxes.size,
  };

  ast.boxes.set(id, box);
  return id;
}

export function createBoxWithMembers(
  ast: MermaidSequenceAST,
  label = 'New Box',
  participantIds: Iterable<string>,
  color?: string
): string {
  const boxId = createBox(ast, label, color);
  for (const pid of participantIds) {
    moveParticipantToBox(ast, pid, boxId);
  }
  return boxId;
}

export function deleteBox(
  ast: MermaidSequenceAST,
  boxId: string,
  deleteMembers: boolean
): void {
  const box = ast.boxes.get(boxId);
  if (!box) return;

  if (deleteMembers) {
    const pids = [...box.participantIds];
    for (const pid of pids) {
      deleteParticipant(ast, pid);
    }
  } else {
    for (const pid of box.participantIds) {
      const part = ast.participants.get(pid);
      if (part) {
        part.boxId = undefined;
      }
    }
  }

  ast.boxes.delete(boxId);
}

export function renameBox(
  ast: MermaidSequenceAST,
  boxId: string,
  label: string
): void {
  const box = ast.boxes.get(boxId);
  if (box) {
    box.label = label;
  }
}

export function moveParticipantToBox(
  ast: MermaidSequenceAST,
  participantId: string,
  boxId?: string | null
): void {
  const part = ast.participants.get(participantId);
  if (!part) return;

  // Remove from old box
  if (part.boxId && ast.boxes.has(part.boxId)) {
    const oldBox = ast.boxes.get(part.boxId)!;
    oldBox.participantIds = oldBox.participantIds.filter((id) => id !== participantId);
  }

  // Add to new box
  if (boxId && ast.boxes.has(boxId)) {
    const newBox = ast.boxes.get(boxId)!;
    if (!newBox.participantIds.includes(participantId)) {
      newBox.participantIds.push(participantId);
    }
    part.boxId = boxId;
  } else {
    part.boxId = undefined;
  }
}

export function moveParticipantsToBox(
  ast: MermaidSequenceAST,
  participantIds: Iterable<string>,
  boxId?: string | null
): void {
  for (const pid of participantIds) {
    moveParticipantToBox(ast, pid, boxId);
  }
}

export function getBoxStyle(
  ast: MermaidSequenceAST,
  boxId: string
): Record<string, string> | undefined {
  const box = ast.boxes.get(boxId);
  return box?.color ? { color: box.color } : undefined;
}

export function updateBoxStyle(
  ast: MermaidSequenceAST,
  boxId: string,
  styles: Record<string, string>
): void {
  const box = ast.boxes.get(boxId);
  if (box && styles.color) {
    box.color = styles.color;
  }
}

export function clearBoxStyle(
  ast: MermaidSequenceAST,
  boxId: string
): void {
  const box = ast.boxes.get(boxId);
  if (box) {
    box.color = undefined;
  }
}

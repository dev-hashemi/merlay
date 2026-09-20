/**
 * Clipboard & Duplication mutations for Mermaid Sequence Diagrams
 */

import { MermaidSequenceAST, SequenceMessageDef, SequenceParticipantDef } from '../types';
import { generateParticipantId } from './participantMutations';
import { generateMessageId } from './messageMutations';

export function duplicateParticipants(
  ast: MermaidSequenceAST,
  participantIds: Iterable<string>
): { participantIds: string[]; messageIds: string[] } {
  const idsSet = new Set(participantIds);
  const idMap = new Map<string, string>();
  const clonedParticipantIds: string[] = [];
  const clonedMessageIds: string[] = [];

  // 1. Duplicate participants
  for (const origId of idsSet) {
    const origPart = ast.participants.get(origId);
    if (!origPart) continue;

    const newId = generateParticipantId('p', ast);
    idMap.set(origId, newId);
    clonedParticipantIds.push(newId);

    const clonedPart: SequenceParticipantDef = {
      type: 'participant',
      id: newId,
      label: `${origPart.label} Copy`,
      kind: origPart.kind,
      boxId: origPart.boxId,
      order: ast.participants.size,
      explicit: true,
      style: origPart.style ? { ...origPart.style } : undefined,
    };

    ast.participants.set(newId, clonedPart);

    if (origPart.boxId && ast.boxes.has(origPart.boxId)) {
      ast.boxes.get(origPart.boxId)!.participantIds.push(newId);
    }
  }

  // 2. Duplicate internal messages between duplicated participants
  const messagesToDuplicate = ast.messages.filter(
    (m) => idsSet.has(m.from) && idsSet.has(m.to)
  );

  for (const origMsg of messagesToDuplicate) {
    const newFrom = idMap.get(origMsg.from);
    const newTo = idMap.get(origMsg.to);
    if (!newFrom || !newTo) continue;

    const newMsgId = generateMessageId(newFrom, newTo, ast);
    clonedMessageIds.push(newMsgId);

    const clonedMsg: SequenceMessageDef = {
      type: 'message',
      id: newMsgId,
      from: newFrom,
      to: newTo,
      arrow: origMsg.arrow,
      label: origMsg.label,
      activateTarget: origMsg.activateTarget,
      deactivateSender: origMsg.deactivateSender,
      order: ast.timeline.length,
    };

    ast.messages.push(clonedMsg);
    ast.timeline.push({ type: 'message', message: clonedMsg });
  }

  return {
    participantIds: clonedParticipantIds,
    messageIds: clonedMessageIds,
  };
}

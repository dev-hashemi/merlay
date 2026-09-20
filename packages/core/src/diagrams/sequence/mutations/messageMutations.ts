/**
 * Message mutations for Mermaid Sequence Diagrams
 */

import {
  MermaidSequenceAST,
  SequenceArrowType,
  SequenceMessageDef,
} from '../types';
import { addParticipant } from './participantMutations';

export function generateMessageId(
  from: string,
  to: string,
  ast?: MermaidSequenceAST
): string {
  const count = (ast ? ast.messages.length : 0) + 1;
  return `msg_${count}_${from}_${to}`;
}

export function connectParticipants(
  ast: MermaidSequenceAST,
  fromId: string,
  toId: string,
  label = 'Message',
  arrow: SequenceArrowType = 'solid_arrow',
  insertAfterMessageId?: string,
  insertAtIndex?: number
): string {
  const id = generateMessageId(fromId, toId, ast);
  const maxOrder = ast.timeline.length;

  const newMsg: SequenceMessageDef = {
    type: 'message',
    id,
    from: fromId,
    to: toId,
    arrow,
    label,
    order: maxOrder,
  };

  if (insertAfterMessageId) {
    const idx = ast.timeline.findIndex(
      (item) => item.type === 'message' && item.message.id === insertAfterMessageId
    );
    if (idx !== -1) {
      let insertIdx = idx + 1;
      while (insertIdx < ast.timeline.length) {
        const item = ast.timeline[insertIdx];
        if (item.type === 'raw' && /^(activate|deactivate)\b/i.test(item.text.trim())) {
          insertIdx++;
        } else {
          break;
        }
      }
      ast.timeline.splice(insertIdx, 0, { type: 'message', message: newMsg });
      ast.messages = ast.timeline
        .filter((item): item is { type: 'message'; message: SequenceMessageDef } => item.type === 'message')
        .map((item) => item.message);
      return id;
    }
  }

  if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= ast.timeline.length) {
    ast.timeline.splice(insertAtIndex, 0, { type: 'message', message: newMsg });
    ast.messages = ast.timeline
      .filter((item): item is { type: 'message'; message: SequenceMessageDef } => item.type === 'message')
      .map((item) => item.message);
    return id;
  }

  ast.timeline.push({ type: 'message', message: newMsg });
  ast.messages = ast.timeline
    .filter((item): item is { type: 'message'; message: SequenceMessageDef } => item.type === 'message')
    .map((item) => item.message);

  return id;
}

export function deleteMessage(
  ast: MermaidSequenceAST,
  messageId: string
): void {
  ast.messages = ast.messages.filter((m) => m.id !== messageId);
  ast.timeline = ast.timeline.filter(
    (item) => !(item.type === 'message' && item.message.id === messageId)
  );
}

export function deleteMessages(
  ast: MermaidSequenceAST,
  messageIds: Iterable<string>
): void {
  const ids = new Set(messageIds);
  ast.messages = ast.messages.filter((m) => !ids.has(m.id));
  ast.timeline = ast.timeline.filter(
    (item) => !(item.type === 'message' && ids.has(item.message.id))
  );
}

export function updateMessageLabel(
  ast: MermaidSequenceAST,
  messageId: string,
  label: string
): void {
  const msg = ast.messages.find((m) => m.id === messageId);
  if (msg) {
    msg.label = label;
  }
}

export function reverseMessage(
  ast: MermaidSequenceAST,
  messageId: string
): string | null {
  const msg = ast.messages.find((m) => m.id === messageId);
  if (!msg) return null;

  const oldFrom = msg.from;
  msg.from = msg.to;
  msg.to = oldFrom;

  return msg.id;
}

export function insertParticipantOnMessage(
  ast: MermaidSequenceAST,
  messageId: string,
  label = 'New Participant'
): string | null {
  const msg = ast.messages.find((m) => m.id === messageId);
  if (!msg) return null;

  const oldTo = msg.to;
  const newPartId = addParticipant(ast, label);

  // 1. First message now points to new participant
  msg.to = newPartId;

  // 2. Second message flows from new participant to original receiver
  const secondMsgId = generateMessageId(newPartId, oldTo, ast);
  const secondMsg: SequenceMessageDef = {
    type: 'message',
    id: secondMsgId,
    from: newPartId,
    to: oldTo,
    arrow: msg.arrow,
    label: 'Reply',
    order: msg.order + 1,
  };

  ast.messages.push(secondMsg);

  // 3. Insert into timeline immediately after the first message
  const timelineIdx = ast.timeline.findIndex(
    (item) => item.type === 'message' && item.message.id === messageId
  );
  if (timelineIdx >= 0) {
    ast.timeline.splice(timelineIdx + 1, 0, {
      type: 'message',
      message: secondMsg,
    });
  } else {
    ast.timeline.push({ type: 'message', message: secondMsg });
  }

  return newPartId;
}

export function mapTypeToSequenceArrow(type: string): SequenceArrowType {
  switch (type) {
    case 'dotted':
      return 'dotted_arrow';
    case 'open':
      return 'solid_open';
    case 'dotted_open':
      return 'dotted_open';
    case 'cross':
      return 'solid_cross';
    case 'arrow':
    default:
      return 'solid_arrow';
  }
}

export function updateMessageType(
  ast: MermaidSequenceAST,
  messageId: string,
  type: string
): void {
  const msg = ast.messages.find((m) => m.id === messageId);
  if (msg) {
    msg.arrow = mapTypeToSequenceArrow(type);
  }
}

export function updateMessagesType(
  ast: MermaidSequenceAST,
  messageIds: Iterable<string>,
  type: string
): void {
  const arrow = mapTypeToSequenceArrow(type);
  for (const id of messageIds) {
    const msg = ast.messages.find((m) => m.id === id);
    if (msg) {
      msg.arrow = arrow;
    }
  }
}

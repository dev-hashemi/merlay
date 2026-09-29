/**
 * Control Frame mutations for Mermaid Sequence Diagrams (loop, alt, opt, par, critical, break, rect)
 */

import { MermaidSequenceAST, SequenceTimelineItem } from '../types';

export type SequenceFrameType =
  | 'loop'
  | 'alt'
  | 'opt'
  | 'par'
  | 'critical'
  | 'break'
  | 'rect';

export interface SequenceFrameDetails {
  type: SequenceFrameType;
  label?: string;
}

/**
 * Wrap one or more messages in a control frame (e.g. loop ... end).
 */
export function wrapMessagesInFrame(
  ast: MermaidSequenceAST,
  messageIds: string[],
  frame: SequenceFrameDetails
): boolean {
  if (!messageIds || messageIds.length === 0) return false;

  const targetSet = new Set(messageIds);
  const indices: number[] = [];

  for (let i = 0; i < ast.timeline.length; i++) {
    const item = ast.timeline[i];
    if (item.type === 'message' && targetSet.has(item.message.id)) {
      indices.push(i);
    }
  }

  if (indices.length === 0) return false;

  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);

  const trimmedLabel = frame.label ? frame.label.trim() : '';
  const startText = trimmedLabel ? `${frame.type} ${trimmedLabel}` : frame.type;
  const endText = 'end';

  const startItem: SequenceTimelineItem = {
    type: 'raw',
    text: startText,
  };

  const endItem: SequenceTimelineItem = {
    type: 'raw',
    text: endText,
  };

  // Insert start item right before minIdx
  ast.timeline.splice(minIdx, 0, startItem);

  // After inserting startItem, the item originally at maxIdx is now at maxIdx + 1.
  // We want to insert endItem right after it, which is at maxIdx + 2.
  ast.timeline.splice(maxIdx + 2, 0, endItem);

  if (!ast.rawLines) {
    ast.rawLines = [];
  }
  ast.rawLines.push({ text: startText }, { text: endText });

  return true;
}

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

export function isFrameStart(text: string): boolean {
  return /^(loop|alt|opt|par|critical|break|rect)\b/i.test(text.trim());
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

/**
 * Delete a control frame by its id (e.g. "frame_2"),
 * removing the frame opening statement and its matching "end", while preserving
 * inner messages.
 */
export function deleteFrame(
  ast: MermaidSequenceAST,
  frameId: string
): boolean {
  let startIdx = -1;
  if (frameId.startsWith('frame_')) {
    const idx = parseInt(frameId.replace('frame_', ''), 10);
    if (!isNaN(idx) && idx >= 0 && idx < ast.timeline.length) {
      const it = ast.timeline[idx];
      if (it.type === 'raw' && isFrameStart(it.text)) {
        startIdx = idx;
      }
    }
  }

  if (startIdx === -1) {
    for (let i = 0; i < ast.timeline.length; i++) {
      const it = ast.timeline[i];
      if (it.type === 'raw' && isFrameStart(it.text)) {
        if (`frame_${i}` === frameId || it.text.trim() === frameId) {
          startIdx = i;
          break;
        }
      }
    }
  }

  if (startIdx === -1) return false;

  // Find matching "end"
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < ast.timeline.length; i++) {
    const it = ast.timeline[i];
    if (it.type === 'raw') {
      const trimmed = it.text.trim();
      if (isFrameStart(trimmed)) {
        depth++;
      } else if (/^end\b/i.test(trimmed)) {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx === -1) return false;

  const startText = (ast.timeline[startIdx] as { text: string }).text.trim();

  // Remove end first, then start (to preserve index stability)
  ast.timeline.splice(endIdx, 1);
  ast.timeline.splice(startIdx, 1);

  // Clean rawLines
  if (ast.rawLines) {
    const sIdx = ast.rawLines.findIndex((r) => r.text.trim() === startText);
    if (sIdx !== -1) ast.rawLines.splice(sIdx, 1);
    const eIdx = ast.rawLines.findIndex((r) => /^end\b/i.test(r.text.trim()));
    if (eIdx !== -1) ast.rawLines.splice(eIdx, 1);
  }

  return true;
}

/**
 * Rename / update the label of a control frame.
 */
export function renameFrame(
  ast: MermaidSequenceAST,
  frameId: string,
  newLabel: string
): boolean {
  let startIdx = -1;
  if (frameId.startsWith('frame_')) {
    const idx = parseInt(frameId.replace('frame_', ''), 10);
    if (!isNaN(idx) && idx >= 0 && idx < ast.timeline.length) {
      const it = ast.timeline[idx];
      if (it.type === 'raw' && isFrameStart(it.text)) {
        startIdx = idx;
      }
    }
  }

  if (startIdx === -1) {
    for (let i = 0; i < ast.timeline.length; i++) {
      const it = ast.timeline[i];
      if (it.type === 'raw' && isFrameStart(it.text)) {
        if (`frame_${i}` === frameId || it.text.trim() === frameId) {
          startIdx = i;
          break;
        }
      }
    }
  }

  if (startIdx === -1) return false;

  const it = ast.timeline[startIdx];
  if (it.type !== 'raw') return false;

  const match = it.text.trim().match(/^(loop|alt|opt|par|critical|break|rect)\b/i);
  if (!match) return false;

  const frameType = match[1];
  const oldText = it.text.trim();
  const cleanLabel = newLabel.trim();
  const newText = cleanLabel ? `${frameType} ${cleanLabel}` : frameType;

  it.text = newText;

  if (ast.rawLines) {
    const raw = ast.rawLines.find((r) => r.text.trim() === oldText);
    if (raw) raw.text = newText;
  }

  return true;
}

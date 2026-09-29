/**
 * Pure parser, formatter, and mutation helpers for diagram Notes.
 * Supports:
 * - Sequence diagram notes: `Note left of/right of/over <p>: <text>`
 * - State diagram notes: `note left of/right of <state> : <text>` and multi-line blocks
 * - Class diagram notes: `note for <Class> "<text>"` and multi-line blocks
 */

export type NotePosition = 'left' | 'right' | 'over';

export interface DiagramNoteDetails {
  text: string;
  position?: NotePosition;
  targetId?: string;
  secondTargetId?: string;
}

/**
 * Parse a sequence note statement:
 *   Note left of Alice: text
 *   Note right of Bob: text
 *   Note over Alice: text
 *   Note over Alice,Bob: text
 */
export function parseSequenceNote(line: string): DiagramNoteDetails | null {
  if (!line || typeof line !== 'string') return null;
  const match = line.match(/^\s*Note\s+(left\s+of|right\s+of|over)\s+([^:]+?)\s*:\s*(.*)$/i);
  if (!match) return null;

  const posStr = match[1].toLowerCase();
  const position: NotePosition = posStr.includes('left')
    ? 'left'
    : posStr.includes('over')
    ? 'over'
    : 'right';

  const targets = match[2]
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (targets.length === 0) return null;

  return {
    position,
    targetId: targets[0],
    secondTargetId: targets[1],
    text: match[3],
  };
}

/**
 * Format a sequence note statement:
 *   Note right of Alice: text
 *   Note over Alice,Bob: text
 */
export function formatSequenceNote(note: DiagramNoteDetails): string {
  const pos = note.position || 'right';
  const target = note.targetId || 'Alice';
  const text = note.text.replace(/\r?\n/g, '<br/>');

  if (pos === 'over') {
    return note.secondTargetId
      ? `Note over ${target},${note.secondTargetId}: ${text}`
      : `Note over ${target}: ${text}`;
  }
  return `Note ${pos} of ${target}: ${text}`;
}

/**
 * Parse a state note line or scan a block:
 *   note right of State1 : text
 *   note left of State1\n...\nend note
 */
export function parseStateNoteLine(line: string): DiagramNoteDetails | null {
  if (!line || typeof line !== 'string') return null;
  const match = line.match(/^\s*note\s+(right\s+of|left\s+of)\s+(\S+)\s*:\s*(.*)$/i);
  if (!match) return null;

  const posStr = match[1].toLowerCase();
  const position: NotePosition = posStr.includes('left') ? 'left' : 'right';

  return {
    position,
    targetId: match[2],
    text: match[3].trim(),
  };
}

/**
 * Format a state note statement.
 */
export function formatStateNote(note: DiagramNoteDetails): string {
  const pos = note.position === 'left' ? 'left' : 'right';
  const target = note.targetId || 'State';
  const clean = note.text.trim();

  if (clean.includes('\n')) {
    const indented = clean
      .split('\n')
      .map((l) => `    ${l.trim()}`)
      .join('\n');
    return `note ${pos} of ${target}\n${indented}\nend note`;
  }
  return `note ${pos} of ${target} : ${clean}`;
}

/**
 * Parse a class note line:
 *   note for ClassName "text"
 *   note for ClassName : "text"
 */
export function parseClassNoteLine(line: string): DiagramNoteDetails | null {
  if (!line || typeof line !== 'string') return null;
  const match = line.match(/^\s*note\s+for\s+(\S+)\s*[:\s]\s*["']?([^"']+)["']?/i);
  if (!match) return null;

  return {
    targetId: match[1],
    text: match[2].trim(),
  };
}

/**
 * Format a class-bound note statement.
 */
export function formatClassNote(note: DiagramNoteDetails): string {
  const target = note.targetId || 'ClassName';
  const clean = note.text.trim();

  if (clean.includes('\n')) {
    const indented = clean
      .split('\n')
      .map((l) => `    ${l.trim()}`)
      .join('\n');
    return `note for ${target}\n${indented}\nend note`;
  }
  return `note for ${target} "${clean}"`;
}

/**
 * Extract text from raw item ({ text: string } | { raw: string } | string).
 */
function getRawText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const obj = item as { text?: string; raw?: string };
    return obj.text ?? obj.raw ?? '';
  }
  return '';
}

/**
 * Find notes matching a given target ID in a raw lines array.
 */
export function findNotesForTarget<T>(
  rawLines: T[],
  targetId: string | undefined,
  kind: 'sequence' | 'state' | 'class'
): DiagramNoteDetails[] {
  const results: DiagramNoteDetails[] = [];
  const lines = rawLines.map(getRawText);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (kind === 'sequence') {
      const parsed = parseSequenceNote(line);
      if (
        parsed &&
        (!targetId || parsed.targetId === targetId || parsed.secondTargetId === targetId)
      ) {
        results.push(parsed);
      }
    } else if (kind === 'state') {
      const single = parseStateNoteLine(line);
      if (single && (!targetId || single.targetId === targetId)) {
        results.push(single);
        continue;
      }
      // Check multi-line block header: note (right|left) of <targetId>
      const blockHeader = line.match(/^\s*note\s+(right\s+of|left\s+of)\s+(\S+)\s*$/i);
      if (blockHeader && (!targetId || blockHeader[2] === targetId)) {
        const pos: NotePosition = blockHeader[1].toLowerCase().includes('left') ? 'left' : 'right';
        const bodyLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !/^\s*end\s+note\b/i.test(lines[j])) {
          bodyLines.push(lines[j].trim());
          j++;
        }
        results.push({
          position: pos,
          targetId: blockHeader[2],
          text: bodyLines.join('\n'),
        });
        i = j; // skip consumed block
      }
    } else if (kind === 'class') {
      const single = parseClassNoteLine(line);
      if (single && (!targetId || single.targetId === targetId)) {
        results.push(single);
        continue;
      }
      // Multi-line block header: note for <targetId>
      const blockHeader = line.match(/^\s*note\s+for\s+(\S+)\s*$/i);
      if (blockHeader && (!targetId || blockHeader[1] === targetId)) {
        const bodyLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !/^\s*end\s+note\b/i.test(lines[j])) {
          bodyLines.push(lines[j].trim());
          j++;
        }
        results.push({
          targetId: blockHeader[1],
          text: bodyLines.join('\n'),
        });
        i = j;
      }
    }
  }

  return results;
}

/**
 * Updates, adds, or removes a note attached to a target ID in raw lines.
 */
export function updateNoteInRawLines<T extends object | string>(
  rawLines: T[],
  targetId: string,
  note: DiagramNoteDetails | null,
  kind: 'sequence' | 'state' | 'class'
): void {
  const lines = rawLines.map(getRawText);

  // Find start and end index of existing note for targetId
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (kind === 'sequence') {
      const parsed = parseSequenceNote(line);
      if (
        parsed &&
        (parsed.targetId === targetId || parsed.secondTargetId === targetId)
      ) {
        startIdx = i;
        endIdx = i;
        break;
      }
    } else if (kind === 'state') {
      const single = parseStateNoteLine(line);
      if (single && single.targetId === targetId) {
        startIdx = i;
        endIdx = i;
        break;
      }
      const blockHeader = line.match(/^\s*note\s+(right\s+of|left\s+of)\s+(\S+)\s*$/i);
      if (blockHeader && blockHeader[2] === targetId) {
        startIdx = i;
        let j = i + 1;
        while (j < lines.length && !/^\s*end\s+note\b/i.test(lines[j])) {
          j++;
        }
        endIdx = j < lines.length ? j : lines.length - 1;
        break;
      }
    } else if (kind === 'class') {
      const single = parseClassNoteLine(line);
      if (single && single.targetId === targetId) {
        startIdx = i;
        endIdx = i;
        break;
      }
      const blockHeader = line.match(/^\s*note\s+for\s+(\S+)\s*$/i);
      if (blockHeader && blockHeader[1] === targetId) {
        startIdx = i;
        let j = i + 1;
        while (j < lines.length && !/^\s*end\s+note\b/i.test(lines[j])) {
          j++;
        }
        endIdx = j < lines.length ? j : lines.length - 1;
        break;
      }
    }
  }

  // Deletion
  if (!note || !note.text.trim()) {
    if (startIdx !== -1) {
      const count = endIdx - startIdx + 1;
      rawLines.splice(startIdx, count);
    }
    return;
  }

  // Formatting new statement
  let formatted = '';
  if (kind === 'sequence') {
    formatted = formatSequenceNote({ ...note, targetId });
  } else if (kind === 'state') {
    formatted = formatStateNote({ ...note, targetId });
  } else {
    formatted = formatClassNote({ ...note, targetId });
  }

  // Helper to construct new line item matching the array item shape
  const createItem = (text: string): T => {
    const first = rawLines[0];
    if (typeof first === 'object' && first !== null && 'raw' in first) {
      return { raw: text, order: rawLines.length + 1 } as unknown as T;
    }
    if (typeof first === 'object' && first !== null && 'text' in first) {
      return { type: 'raw', text } as unknown as T;
    }
    if (kind === 'class') {
      return { raw: text, order: 1 } as unknown as T;
    }
    return { type: 'raw', text } as unknown as T;
  };

  const newItems: T[] = formatted.split('\n').map((l) => createItem(l));

  if (startIdx !== -1) {
    const count = endIdx - startIdx + 1;
    rawLines.splice(startIdx, count, ...newItems);
  } else {
    rawLines.push(...newItems);
  }
}

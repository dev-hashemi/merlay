/**
 * Universal Diagram Accessibility (accTitle, accDescr)
 *
 * Implements parsing and updating for Mermaid accessibility directives
 * across Flowchart, Sequence, State, and Class diagrams.
 */

export interface DiagramAccessibility {
  accTitle?: string;
  accDescr?: string;
}

function getRawText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const obj = item as { text?: string; raw?: string };
    return obj.text ?? obj.raw ?? '';
  }
  return '';
}

/**
 * Parses accessibility directives (accTitle, accDescr) from raw lines.
 */
export function parseDiagramAccessibility(rawLines: unknown[]): DiagramAccessibility {
  const result: DiagramAccessibility = {};
  const lines = rawLines.map(getRawText);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1. accTitle (: optional)
    const titleMatch = line.match(/^accTitle\s*:?\s*(.*)$/i);
    if (titleMatch && !result.accTitle) {
      result.accTitle = titleMatch[1].trim();
      continue;
    }

    // 2. multi-line accDescr { ... }
    const multiMatch = line.match(/^accDescr\s*\{\s*$/i);
    if (multiMatch) {
      const descrLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const inner = lines[j];
        if (/^\s*\}\s*$/.test(inner)) {
          break;
        }
        descrLines.push(inner.trim());
        j++;
      }
      i = j;
      result.accDescr = descrLines.join('\n');
      continue;
    }

    // 3. single-line accDescr (: optional)
    const singleMatch = line.match(/^accDescr\s*:?\s*(.*)$/i);
    if (singleMatch && !result.accDescr) {
      result.accDescr = singleMatch[1].trim();
      continue;
    }
  }

  return result;
}

/**
 * Updates, adds, or removes accessibility directives in raw lines array.
 */
export function updateDiagramAccessibility<T extends object | string>(
  rawLines: T[],
  acc: DiagramAccessibility | null
): void {
  // 1. Remove all existing accTitle and accDescr statements
  let i = 0;
  while (i < rawLines.length) {
    const text = getRawText(rawLines[i]).trim();

    if (/^accTitle\b/i.test(text)) {
      rawLines.splice(i, 1);
      continue;
    }

    if (/^accDescr\s*\{\s*$/i.test(text)) {
      let j = i + 1;
      while (j < rawLines.length && !/^\s*\}\s*$/.test(getRawText(rawLines[j]))) {
        j++;
      }
      const count = j < rawLines.length ? j - i + 1 : rawLines.length - i;
      rawLines.splice(i, count);
      continue;
    }

    if (/^accDescr\b/i.test(text)) {
      rawLines.splice(i, 1);
      continue;
    }

    i++;
  }

  // If no new accessibility metadata, we're done
  const cleanTitle = acc?.accTitle?.trim();
  const cleanDescr = acc?.accDescr?.trim();
  if (!cleanTitle && !cleanDescr) {
    return;
  }

  // 2. Construct new statements
  const newLines: string[] = [];
  if (cleanTitle) {
    newLines.push(`accTitle: ${cleanTitle}`);
  }

  if (cleanDescr) {
    if (cleanDescr.includes('\n')) {
      newLines.push('accDescr {');
      for (const line of cleanDescr.split('\n')) {
        newLines.push(`    ${line.trim()}`);
      }
      newLines.push('}');
    } else {
      newLines.push(`accDescr: ${cleanDescr}`);
    }
  }

  const createItem = (line: string): T => {
    return { type: 'raw', text: line, raw: line, order: 0 } as unknown as T;
  };

  const newItems: T[] = newLines.map(createItem);

  // Insert at beginning of rawLines (top-level diagram metadata)
  rawLines.unshift(...newItems);
}

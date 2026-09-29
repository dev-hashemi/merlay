/**
 * Shared helpers for interactivity hyperlinks (`click` / `link` statements).
 *
 * These statements are preserved in each driver's rawLines. The canvas uses them
 * to offer "Open link", "Add link", "Edit link", and "Remove link" affordances
 * while edit-mode clicks are reserved for selection.
 */

/** A hyperlink attached to a node with optional tooltip and target window. */
export interface NodeLinkDetails {
  url: string;
  tooltip?: string;
  target?: string;
}

export interface NodeLink {
  nodeId: string;
  url?: string;
}

/**
 * Parse a flowchart/state `click` statement:
 *   click <id> href "url" ["tooltip"] [target]
 *   click <id> "url" ["tooltip"]
 *   click <id> call fn() ["tooltip"]
 * Returns null for anything else (including `call` without a URL — the
 * callback form has no URL to open).
 */
export function parseClickLink(text?: string): NodeLink | null {
  if (!text || typeof text !== 'string') return null;
  const m = /^\s*(?:click|link)\s+(\S+)\s+(?:href\s+)?["']([^"']+)["']/i.exec(text);
  if (!m) return null;
  return { nodeId: m[1], url: m[2] };
}

/**
 * Detailed parse of a flowchart/state `click` statement, capturing tooltip and target.
 */
export function parseClickLinkDetails(text?: string): { nodeId: string; details: NodeLinkDetails } | null {
  if (!text || typeof text !== 'string') return null;
  const m = /^\s*(?:click|link)\s+(\S+)\s+(?:href\s+)?["']([^"']+)["'](?:\s+["']([^"']*)["'])?(?:\s+(_blank|_self|_parent|_top|\S+))?/i.exec(text);
  if (!m) return null;
  const details: NodeLinkDetails = { url: m[2] };
  if (m[3]) details.tooltip = m[3];
  if (m[4]) details.target = m[4];
  return { nodeId: m[1], details };
}

/**
 * Parse a sequence `link`/`links` statement:
 *   link <id>: Label @ https://...
 *   links <id>: {"Label": "https://..."}
 * Returns the first URL found, or null.
 */
export function parseSequenceLink(text?: string): NodeLink | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const idMatch = /^\s*links?\s+(\S+)\s*:/i.exec(trimmed);
  if (!idMatch) return null;
  const nodeId = idMatch[1];
  // Singular `link Id: Label @ url` — the URL follows the last @.
  const atIdx = trimmed.lastIndexOf('@');
  if (/^\s*link\s/i.test(trimmed) && !/^\s*links\s/i.test(trimmed) && atIdx !== -1) {
    const url = trimmed
      .slice(atIdx + 1)
      .trim()
      .split(/\s+/)[0]
      ?.replace(/,+$/, '');
    if (url) return { nodeId, url };
    return null;
  }
  // Plural `links Id: {...}` — first quoted URL in the map.
  const urlMatch = /"(https?:[^"]+)"/i.exec(trimmed);
  if (urlMatch) return { nodeId, url: urlMatch[1] };
  return null;
}

/**
 * Detailed parse of a sequence `link`/`links` statement, capturing label as tooltip.
 */
export function parseSequenceLinkDetails(text?: string): { nodeId: string; details: NodeLinkDetails } | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const idMatch = /^\s*links?\s+(\S+)\s*:/i.exec(trimmed);
  if (!idMatch) return null;
  const nodeId = idMatch[1];
  const atIdx = trimmed.lastIndexOf('@');
  if (/^\s*link\s/i.test(trimmed) && !/^\s*links\s/i.test(trimmed) && atIdx !== -1) {
    const colonIdx = trimmed.indexOf(':');
    const label = colonIdx !== -1 && colonIdx < atIdx
      ? trimmed.slice(colonIdx + 1, atIdx).trim()
      : undefined;
    const url = trimmed
      .slice(atIdx + 1)
      .trim()
      .split(/\s+/)[0]
      ?.replace(/,+$/, '');
    if (url) {
      const details: NodeLinkDetails = { url };
      if (label) details.tooltip = label;
      return { nodeId, details };
    }
    return null;
  }
  const urlMatch = /"(https?:[^"]+)"/i.exec(trimmed);
  if (urlMatch) return { nodeId, details: { url: urlMatch[1] } };
  return null;
}

/**
 * Find the openable URL attached to a node by scanning preserved raw lines.
 * Tries `click` syntax first, then sequence `link` syntax.
 */
export function findNodeLinkUrl(
  texts: Iterable<string | undefined>,
  nodeId: string
): string | undefined {
  for (const text of texts) {
    if (!text || typeof text !== 'string') continue;
    const click = parseClickLink(text);
    if (click && click.nodeId === nodeId && click.url) return click.url;
  }
  for (const text of texts) {
    if (!text || typeof text !== 'string') continue;
    const link = parseSequenceLink(text);
    if (link && link.nodeId === nodeId && link.url) return link.url;
  }
  return undefined;
}

/**
 * Find all link details (URL, tooltip, target) attached to a node.
 */
export function findNodeLinkDetails(
  texts: Iterable<string | undefined>,
  nodeId: string
): NodeLinkDetails | undefined {
  for (const text of texts) {
    if (!text || typeof text !== 'string') continue;
    const click = parseClickLinkDetails(text);
    if (click && click.nodeId === nodeId && click.details.url) {
      return click.details;
    }
  }
  for (const text of texts) {
    if (!text || typeof text !== 'string') continue;
    const link = parseSequenceLinkDetails(text);
    if (link && link.nodeId === nodeId && link.details.url) {
      return link.details;
    }
  }
  return undefined;
}

/**
 * Formats a clean standard Mermaid statement for a node link.
 */
export function formatNodeLinkStatement(
  nodeId: string,
  details: NodeLinkDetails,
  syntaxKind: 'click' | 'link' | 'sequence' = 'click'
): string {
  const url = details.url.trim();
  const tooltip = details.tooltip?.trim();
  const target = details.target?.trim();

  if (syntaxKind === 'sequence') {
    const label = tooltip || 'Link';
    return `link ${nodeId}: ${label} @ ${url}`;
  }

  if (syntaxKind === 'link') {
    const tipPart = tooltip ? ` "${tooltip}"` : '';
    return `link ${nodeId} "${url}"${tipPart}`;
  }

  // flowchart 'click'
  const tipPart = tooltip ? ` "${tooltip}"` : '';
  const tgtPart = target ? ` ${target}` : '';
  return `click ${nodeId} "${url}"${tipPart}${tgtPart}`;
}

/**
 * Updates or removes a node's click/link statement in a rawLines array in place.
 */
export function updateNodeLinkInRawLines<T extends { text?: string; raw?: string } | string>(
  rawLines: T[],
  nodeId: string,
  link: NodeLinkDetails | null,
  syntaxKind: 'click' | 'link' | 'sequence' = 'click'
): void {
  const getText = (item: T): string => {
    return typeof item === 'string' ? item : (item.text ?? item.raw ?? '');
  };

  const isTargetLine = (text: string): boolean => {
    if (syntaxKind === 'sequence') {
      const parsed = parseSequenceLink(text);
      return parsed?.nodeId === nodeId;
    }
    const parsed = parseClickLink(text);
    return parsed?.nodeId === nodeId;
  };

  const existingIdx = rawLines.findIndex((r) => isTargetLine(getText(r)));

  if (!link || !link.url.trim()) {
    if (existingIdx !== -1) {
      rawLines.splice(existingIdx, 1);
    }
    return;
  }

  const newLineText = formatNodeLinkStatement(nodeId, link, syntaxKind);
  if (existingIdx !== -1) {
    const existing = rawLines[existingIdx];
    if (typeof existing === 'string') {
      rawLines[existingIdx] = newLineText as T;
    } else if (typeof existing === 'object' && existing !== null) {
      if ('raw' in existing) {
        rawLines[existingIdx] = { ...existing, raw: newLineText } as T;
      } else {
        rawLines[existingIdx] = { ...existing, text: newLineText } as T;
      }
    }
  } else {
    // Append
    const first = rawLines[0];
    if (typeof first === 'object' && first !== null && 'raw' in first) {
      rawLines.push({ raw: newLineText, order: rawLines.length + 1 } as unknown as T);
    } else if (typeof first === 'object' && first !== null && 'text' in first) {
      rawLines.push({ type: 'raw', text: newLineText } as unknown as T);
    } else if (syntaxKind === 'link') {
      rawLines.push({ raw: newLineText, order: 1 } as unknown as T);
    } else {
      rawLines.push({ type: 'raw', text: newLineText } as unknown as T);
    }
  }
}

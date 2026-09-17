/**
 * Shared helpers for interactivity hyperlinks (`click` / `link` statements).
 *
 * These statements are preserved verbatim in each driver's rawLines (never
 * modeled in the AST). The canvas needs just one thing from them: the URL
 * attached to a node, to offer an "Open link" affordance while edit-mode
 * clicks are reserved for selection.
 */

/** A hyperlink attached to a node via a preserved `click`/`link` line. */
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
export function parseClickLink(text: string): NodeLink | null {
  const m = /^\s*click\s+(\S+)\s+(?:href\s+)?["']([^"']+)["']/i.exec(text);
  if (!m) return null;
  return { nodeId: m[1], url: m[2] };
}

/**
 * Parse a sequence `link`/`links` statement:
 *   link <id>: Label @ https://...
 *   links <id>: {"Label": "https://..."}
 * Returns the first URL found, or null.
 */
export function parseSequenceLink(text: string): NodeLink | null {
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
 * Find the openable URL attached to a node by scanning preserved raw lines.
 * Tries `click` syntax first, then sequence `link` syntax.
 */
export function findNodeLinkUrl(
  texts: Iterable<string>,
  nodeId: string
): string | undefined {
  for (const text of texts) {
    const click = parseClickLink(text);
    if (click && click.nodeId === nodeId && click.url) return click.url;
  }
  for (const text of texts) {
    const link = parseSequenceLink(text);
    if (link && link.nodeId === nodeId && link.url) return link.url;
  }
  return undefined;
}

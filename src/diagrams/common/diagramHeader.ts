/**
 * Shared diagram plumbing: YAML frontmatter, header detection, unique ids.
 *
 * These helpers are identical across every Mermaid diagram kind (Mermaid
 * treats a leading `--- ... ---` block, `%%` comments, and the first
 * substantive header line the same everywhere). Per-diagram lexers, parsers,
 * serializers, and mutation semantics stay in their own packages.
 */

export * from './diagramTheme';

export interface SplitFrontmatterResult {
  /** Inner YAML lines (without the `---` delimiters), if a leading block exists. */
  frontmatter?: string;
  /** Original input with only the frontmatter block removed (comments kept). */
  body: string;
}

function isBlankOrComment(trimmed: string): boolean {
  return trimmed === '' || trimmed.startsWith('%%');
}

/**
 * Extract a leading YAML frontmatter block (`--- ... ---`).
 *
 * Allows leading blank lines and `%%` comments before the block (matching
 * state/sequence lexer behavior). Only the FIRST block counts; a `---`
 * line after real code is content, not frontmatter. Unclosed blocks are
 * ignored (returned as body) so a diagram is never swallowed silently.
 */
export function splitFrontmatter(input: string): SplitFrontmatterResult {
  const lines = input.split('\n');

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isBlankOrComment(trimmed)) continue;
    if (trimmed === '---') start = i;
    break;
  }
  if (start === -1) return { frontmatter: undefined, body: input };

  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontmatter: undefined, body: input };

  const frontmatter = lines.slice(start + 1, end).join('\n');
  const body = [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n');
  return { frontmatter, body };
}

/**
 * First substantive line of a diagram: skips blanks, `%%` comments, and a
 * leading frontmatter block. Used for header detection (`flowchart`,
 * `stateDiagram-v2`, `sequenceDiagram`, ...).
 */
export function findFirstCodeLine(code: string): string | undefined {
  const { body } = splitFrontmatter(code);
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (isBlankOrComment(trimmed)) continue;
    return trimmed;
  }
  return undefined;
}

/** True when the diagram's first code line matches the header pattern. */
export function matchesHeader(code: string, pattern: RegExp): boolean {
  const first = findFirstCodeLine(code);
  return first !== undefined && pattern.test(first);
}

/** Append a `--- ... ---` block to serializer output lines, if present. */
export function emitFrontmatter(lines: string[], frontmatter?: string): void {
  if (!frontmatter) return;
  lines.push('---');
  lines.push(frontmatter);
  lines.push('---');
}

/**
 * Deterministic collision-free id: `<base>_<n>` starting at
 * `existing.size + 1`. Callers pass the union of relevant collections
 * (e.g. states + composites, participants + boxes).
 */
export function generateUniqueId(
  existing: ReadonlySet<string>,
  base: string
): string {
  let counter = existing.size + 1;
  let candidate = `${base}_${counter}`;
  while (existing.has(candidate)) {
    counter++;
    candidate = `${base}_${counter}`;
  }
  return candidate;
}

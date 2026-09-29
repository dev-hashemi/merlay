/**
 * Shared diagram plumbing: YAML frontmatter, header detection, unique ids.
 *
 * These helpers are identical across every Mermaid diagram kind (Mermaid
 * treats a leading `--- ... ---` block, `%%` comments, and the first
 * substantive header line the same everywhere). Per-diagram lexers, parsers,
 * serializers, and mutation semantics stay in their own packages.
 */

export * from './diagramTheme';
export * from './diagramTitle';

export interface SplitFrontmatterResult {
  /** Inner YAML lines (without the `---` delimiters), if a leading block exists. */
  frontmatter?: string;
  /** Extracted leading directives (e.g. `%%{init: ...}%%`), preserved verbatim. */
  directives?: string[];
  /** Original input with only the frontmatter and leading directive blocks removed (comments kept). */
  body: string;
}

function isBlankOrComment(trimmed: string): boolean {
  return trimmed === '' || trimmed.startsWith('%%');
}

/**
 * Extract a leading YAML frontmatter block (`--- ... ---`) and any leading
 * Mermaid directives (`%%{ ... }%%`, single or multi-line).
 *
 * Allows leading blank lines and `%%` comments before/between blocks.
 * Only the FIRST frontmatter block counts; a `---` line after real code is
 * content, not frontmatter. Unclosed blocks are ignored (returned as body) so
 * a diagram is never swallowed silently.
 */
export function splitFrontmatter(input: string): SplitFrontmatterResult {
  const lines = input.split('\n');
  const removedLineIndices = new Set<number>();
  let frontmatter: string | undefined = undefined;
  const directives: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Directives: %%{ ... }%% (single-line or multi-line)
    if (trimmed.startsWith('%%{')) {
      let dirEnd = -1;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('}%%')) {
          dirEnd = j;
          break;
        }
      }
      if (dirEnd !== -1) {
        directives.push(lines.slice(i, dirEnd + 1).join('\n'));
        for (let k = i; k <= dirEnd; k++) {
          removedLineIndices.add(k);
        }
        i = dirEnd + 1;
        continue;
      }
      // If unclosed, do not treat as directive, treat as real content and stop
      break;
    }

    // Regular comments: %% ... (keep in body, allowed in preamble)
    if (trimmed.startsWith('%%')) {
      i++;
      continue;
    }

    // Frontmatter: --- ... --- (only the first block counts)
    if (trimmed === '---' && frontmatter === undefined) {
      let fmEnd = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '---') {
          fmEnd = j;
          break;
        }
      }
      if (fmEnd !== -1) {
        frontmatter = lines.slice(i + 1, fmEnd).join('\n');
        for (let k = i; k <= fmEnd; k++) {
          removedLineIndices.add(k);
        }
        i = fmEnd + 1;
        continue;
      }
      // If unclosed, do not treat as frontmatter, stop
      break;
    }

    // Any other substantive code line means we have reached the diagram body
    break;
  }

  const bodyLines = lines.filter((_, idx) => !removedLineIndices.has(idx));
  const body = bodyLines.join('\n');

  return {
    frontmatter,
    directives: directives.length > 0 ? directives : undefined,
    body,
  };
}

/**
 * First substantive line of a diagram: skips blanks, `%%` comments, and any
 * leading frontmatter or directive blocks. Used for header detection (`flowchart`,
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

/** Append leading directives to serializer output lines, if present. */
export function emitDirectives(lines: string[], directives?: string[]): void {
  if (!directives || directives.length === 0) return;
  for (const directive of directives) {
    lines.push(directive);
  }
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

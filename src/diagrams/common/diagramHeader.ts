/**
 * Shared diagram plumbing: YAML frontmatter, header detection, unique ids.
 *
 * These helpers are identical across every Mermaid diagram kind (Mermaid
 * treats a leading `--- ... ---` block, `%%` comments, and the first
 * substantive header line the same everywhere). Per-diagram lexers, parsers,
 * serializers, and mutation semantics stay in their own packages.
 */

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

export type MermaidTheme = 'default' | 'neutral' | 'forest' | 'dark' | 'base';

export const MERMAID_THEMES: readonly MermaidTheme[] = [
  'default',
  'neutral',
  'forest',
  'dark',
  'base',
];

/**
 * Extract the configured Mermaid diagram theme from YAML frontmatter or directive.
 *
 * Checks frontmatter `config: { theme: ... }` / `config:\n theme: ...` or
 * fallback top-level `theme: ...` or body `%%{init: {'theme': '...'}}%%`.
 */
export function getDiagramTheme(
  frontmatter?: string,
  body?: string
): MermaidTheme | undefined {
  if (frontmatter) {
    const lines = frontmatter.split('\n');
    let inConfig = false;
    let configIndent = -1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);

      // Check inline config: "config: { theme: ... }"
      const inlineMatch = trimmed.match(/^config\s*:\s*\{([^}]+)\}/);
      if (inlineMatch) {
        const themeMatch = inlineMatch[1].match(
          /(?:^|[,{\s])['"]?theme['"]?\s*:\s*['"]?([a-zA-Z0-9_-]+)['"]?/
        );
        if (themeMatch) {
          return themeMatch[1].toLowerCase() as MermaidTheme;
        }
      }

      // Check config header: "config:"
      if (/^config\s*:/.test(trimmed)) {
        inConfig = true;
        configIndent = indent;
        continue;
      }

      if (inConfig) {
        if (indent <= configIndent && !trimmed.startsWith('-')) {
          inConfig = false;
        } else {
          const match = trimmed.match(
            /^['"]?theme['"]?\s*:\s*['"]?([a-zA-Z0-9_-]+)['"]?/
          );
          if (match) {
            return match[1].toLowerCase() as MermaidTheme;
          }
        }
      }

      // Fallback top-level theme key
      const topMatch = trimmed.match(
        /^['"]?theme['"]?\s*:\s*['"]?([a-zA-Z0-9_-]+)['"]?/
      );
      if (topMatch && !inConfig) {
        return topMatch[1].toLowerCase() as MermaidTheme;
      }
    }
  }

  if (body) {
    const initMatch = body.match(
      /%%\{init:\s*\{.*?['"]theme['"]\s*:\s*['"]([a-zA-Z0-9_-]+)['"].*?\}\}%%/
    );
    if (initMatch) {
      return initMatch[1].toLowerCase() as MermaidTheme;
    }
  }

  return undefined;
}

/**
 * Pure mutation helper to update or remove the Mermaid theme in YAML frontmatter.
 *
 * Emits 100% standard Mermaid YAML frontmatter without proprietary lock-in.
 * Preserves all other frontmatter properties (title, look, etc.) and comments verbatim.
 * If theme is null/undefined and frontmatter becomes empty, returns undefined.
 */
export function setDiagramTheme(
  frontmatter: string | undefined,
  theme: MermaidTheme | string | null | undefined
): string | undefined {
  if (!theme) {
    if (!frontmatter) return undefined;
    const lines = frontmatter.split('\n');
    const newLines: string[] = [];
    let inConfig = false;
    let configIndent = -1;
    let configLineIdx = -1;
    let configHasOtherKeys = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indent = line.search(/\S/);

      if (/^['"]?theme['"]?\s*:/.test(trimmed) && !inConfig) {
        continue;
      }

      if (/^config\s*:/.test(trimmed)) {
        if (/^config\s*:\s*\{/.test(trimmed)) {
          const inner = trimmed
            .replace(/^config\s*:\s*\{/, '')
            .replace(/\}\s*$/, '');
          const parts = inner
            .split(',')
            .map((p) => p.trim())
            .filter((p) => !/^['"]?theme['"]?\s*:/.test(p));
          if (parts.length > 0) {
            newLines.push('config: { ' + parts.join(', ') + ' }');
          }
          continue;
        }
        inConfig = true;
        configIndent = indent;
        configLineIdx = newLines.length;
        newLines.push(line);
        configHasOtherKeys = false;
        continue;
      }

      if (inConfig) {
        if (
          indent <= configIndent &&
          trimmed !== '' &&
          !trimmed.startsWith('-')
        ) {
          inConfig = false;
        } else {
          if (/^['"]?theme['"]?\s*:/.test(trimmed)) {
            continue;
          }
          if (trimmed !== '') {
            configHasOtherKeys = true;
          }
        }
      }

      newLines.push(line);
    }

    if (!configHasOtherKeys && configLineIdx !== -1) {
      newLines.splice(configLineIdx, 1);
    }

    const result = newLines.join('\n').trim();
    return result.length > 0 ? result : undefined;
  }

  // Setting a theme
  if (!frontmatter || frontmatter.trim() === '') {
    return `config:\n  theme: ${theme}`;
  }

  const lines = frontmatter.split('\n');
  let configFound = false;
  let themeFound = false;
  const newLines: string[] = [];
  let inConfig = false;
  let configIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.search(/\S/);

    if (!inConfig && /^['"]?theme['"]?\s*:/.test(trimmed)) {
      themeFound = true;
      newLines.push(`config:\n  theme: ${theme}`);
      continue;
    }

    if (/^config\s*:/.test(trimmed)) {
      configFound = true;
      if (/^config\s*:\s*\{/.test(trimmed)) {
        const inner = trimmed
          .replace(/^config\s*:\s*\{/, '')
          .replace(/\}\s*$/, '');
        const parts = inner
          .split(',')
          .map((p) => p.trim())
          .filter((p) => !/^['"]?theme['"]?\s*:/.test(p));
        parts.unshift(`theme: ${theme}`);
        newLines.push('config: { ' + parts.join(', ') + ' }');
        themeFound = true;
        continue;
      }
      inConfig = true;
      configIndent = indent;
      newLines.push(line);
      continue;
    }

    if (inConfig) {
      if (
        indent <= configIndent &&
        trimmed !== '' &&
        !trimmed.startsWith('-')
      ) {
        if (!themeFound) {
          newLines.push(`  theme: ${theme}`);
          themeFound = true;
        }
        inConfig = false;
      } else if (/^['"]?theme['"]?\s*:/.test(trimmed)) {
        newLines.push(`  theme: ${theme}`);
        themeFound = true;
        continue;
      }
    }

    newLines.push(line);
  }

  if (inConfig && !themeFound) {
    newLines.push(`  theme: ${theme}`);
    themeFound = true;
  }

  if (!configFound && !themeFound) {
    newLines.push(`config:\n  theme: ${theme}`);
  }

  return newLines.join('\n').trim();
}


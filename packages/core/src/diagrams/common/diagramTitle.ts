/**
 * Shared diagram title plumbing: extraction and pure mutations in YAML frontmatter.
 *
 * Supported uniformly across all Mermaid diagram types via standard YAML frontmatter:
 * ---
 * title: My Diagram Title
 * ---
 * Also provides fallback reading for in-diagram `title ...` or `title: ...` statements.
 */

function unquoteTitle(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function quoteTitleIfNeeded(title: string): string {
  const trimmed = title.trim();
  // Quote if contains YAML special chars or colons
  if (/[:#{}[\],&*?|><=!%@`]/.test(trimmed) || trimmed !== title) {
    return `"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return trimmed;
}

/**
 * Extract diagram title from YAML frontmatter, with fallback to in-body raw lines.
 */
export function getDiagramTitle(
  frontmatter?: string,
  rawLines?: Iterable<{ text?: string; raw?: string } | string>
): string | undefined {
  if (frontmatter) {
    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^title\s*:\s*(.+)$/i);
      if (match) {
        const val = unquoteTitle(match[1]);
        if (val) return val;
      }
    }
  }

  if (rawLines) {
    for (const item of rawLines) {
      const line = typeof item === 'string' ? item : item.text ?? item.raw ?? '';
      const trimmed = line.trim();
      const match = trimmed.match(/^title(?:\s*:|\s+)\s*(.+)$/i);
      if (match) {
        const val = unquoteTitle(match[1]);
        if (val) return val;
      }
    }
  }

  return undefined;
}

/**
 * Pure mutation helper to set, update, or remove the diagram title in YAML frontmatter.
 *
 * Preserves all other frontmatter properties (config, theme, etc.) and comments.
 * Returns the updated frontmatter string, or undefined if the frontmatter becomes empty.
 */
export function setDiagramTitle(
  frontmatter: string | undefined,
  title: string | null | undefined
): string | undefined {
  const cleanTitle = title?.trim();

  if (!cleanTitle) {
    // Remove title from frontmatter
    if (!frontmatter) return undefined;
    const lines = frontmatter.split('\n');
    const newLines = lines.filter((line) => !/^\s*title\s*:/i.test(line));
    const result = newLines.join('\n').trim();
    return result.length > 0 ? result : undefined;
  }

  const formattedTitleLine = `title: ${quoteTitleIfNeeded(cleanTitle)}`;

  if (!frontmatter) {
    return formattedTitleLine;
  }

  const lines = frontmatter.split('\n');
  let titleFound = false;
  const newLines = lines.map((line) => {
    if (/^\s*title\s*:/i.test(line)) {
      titleFound = true;
      return formattedTitleLine;
    }
    return line;
  });

  if (!titleFound) {
    newLines.unshift(formattedTitleLine);
  }

  return newLines.join('\n').trim();
}

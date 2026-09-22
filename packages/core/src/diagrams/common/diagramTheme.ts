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
  theme: string | null | undefined
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

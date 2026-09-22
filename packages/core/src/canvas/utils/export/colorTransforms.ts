/**
 * Color extraction, theme detection, and dark-mode color transformation.
 */

import { createDiv } from '../../../platform/dom';

/**
 * Checks whether dark theme is currently active.
 */
export function isDarkThemeActive(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.body.classList.contains('theme-dark')) return true;
  if (document.body.classList.contains('theme-light')) return false;
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  } catch {
    return true;
  }
}

export function isConcreteColor(color: string | null | undefined): boolean {
  if (!color) return false;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') return false;
  if (trimmed.startsWith('var(')) return false;
  return true;
}

/**
 * Resolves the theme background color for the diagram.
 * Returns solid opaque background colors matching Obsidian's active theme.
 */
export function resolveThemeBackgroundColor(
  svgMountEl?: HTMLElement | null,
  requestedColor?: string
): string {
  if (isConcreteColor(requestedColor)) {
    return requestedColor!;
  }

  const isDark = isDarkThemeActive();
  const defaultFallback = isDark ? '#1e1e1e' : '#ffffff';

  if (typeof document === 'undefined') return defaultFallback;

  // 1. Try editor root computed background
  if (svgMountEl) {
    const editorRoot = svgMountEl.closest?.('.mermaid-native-editor-root');
    if (editorRoot) {
      try {
        const bg = window.getComputedStyle(editorRoot).backgroundColor;
        if (isConcreteColor(bg)) {
          return bg;
        }
      } catch {
        // ignore
      }
    }
  }

  // 2. Try document.body background
  try {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    if (isConcreteColor(bodyBg)) {
      return bodyBg;
    }
  } catch {
    // ignore
  }

  // 3. Try reading Obsidian's CSS variable via probe element
  try {
    const probe = createDiv('merlay-color-probe');
    document.body.appendChild(probe);
    const probeBg = window.getComputedStyle(probe).backgroundColor;
    probe.remove();
    if (isConcreteColor(probeBg)) {
      return probeBg;
    }
  } catch {
    // ignore
  }

  return defaultFallback;
}

export function getComputedBackgroundColor(svgMountEl?: HTMLElement | null): string {
  return resolveThemeBackgroundColor(svgMountEl);
}

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  orange: '#ffa500',
  pink: '#ffc0cb',
  cyan: '#00ffff',
  magenta: '#ff00ff',
};

/**
 * Parses a CSS hex, rgb, or named color string into [r, g, b, alpha].
 * Returns null for non-concrete colors like 'none', 'transparent', 'currentColor', or 'url(...)'.
 */
export function parseColor(str: string): [number, number, number, number] | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (
    s === 'transparent' ||
    s === 'none' ||
    s === 'inherit' ||
    s === 'currentcolor' ||
    s.startsWith('url(') ||
    s.startsWith('var(')
  ) {
    return null;
  }
  if (NAMED_COLORS[s]) {
    return parseColor(NAMED_COLORS[s]);
  }
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i.exec(s);
  if (hex3) {
    return [
      parseInt(hex3[1] + hex3[1], 16),
      parseInt(hex3[2] + hex3[2], 16),
      parseInt(hex3[3] + hex3[3], 16),
      hex3[4] ? parseInt(hex3[4] + hex3[4], 16) / 255 : 1,
    ];
  }
  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(s);
  if (hex6) {
    return [
      parseInt(hex6[1], 16),
      parseInt(hex6[2], 16),
      parseInt(hex6[3], 16),
      hex6[4] ? parseInt(hex6[4], 16) / 255 : 1,
    ];
  }
  const rgbMatch = /^rgba?\(\s*([0-9]+(?:\.[0-9]+)?%?)[,\s]+([0-9]+(?:\.[0-9]+)?%?)[,\s]+([0-9]+(?:\.[0-9]+)?%?)(?:[\s,/]+([0-9]+(?:\.[0-9]+)?%?))?\s*\)$/i.exec(
    s
  );
  if (rgbMatch) {
    const parseChan = (v: string) =>
      v.endsWith('%') ? Math.round(parseFloat(v) * 2.55) : Math.round(parseFloat(v));
    const a = rgbMatch[4]
      ? rgbMatch[4].endsWith('%')
        ? parseFloat(rgbMatch[4]) / 100
        : parseFloat(rgbMatch[4])
      : 1;
    return [parseChan(rgbMatch[1]), parseChan(rgbMatch[2]), parseChan(rgbMatch[3]), a];
  }
  return null;
}

/**
 * Transforms an RGB/Hex color to its bit-exact equivalent under Obsidian's Dark Mode filter:
 * invert(100%) hue-rotate(180deg) saturate(1.25).
 * Uses the closed-form W3C Filter Effects color matrix.
 */
export function transformColorForDarkMode(colorStr: string): string {
  const parsed = parseColor(colorStr);
  if (!parsed) return colorStr;
  const [r, g, b, a] = parsed;

  const invR = 255 - r;
  const invG = 255 - g;
  const invB = 255 - b;

  const rOut = Math.round(Math.max(0, Math.min(255, -0.77075 * invR + 1.60875 * invG + 0.16200 * invB)));
  const gOut = Math.round(Math.max(0, Math.min(255,  0.47925 * invR + 0.35875 * invG + 0.16200 * invB)));
  const bOut = Math.round(Math.max(0, Math.min(255,  0.47925 * invR + 1.60875 * invG - 1.08800 * invB)));

  if (a < 1) {
    return `rgba(${rOut}, ${gOut}, ${bOut}, ${a.toFixed(2)})`;
  }
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(rOut)}${toHex(gOut)}${toHex(bOut)}`;
}

const COLOR_REGEX = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|\b(?:white|black|red|green|blue|yellow|purple|gray|grey|lightgray|lightgrey|darkgray|darkgrey|orange|pink|cyan|magenta)\b)/gi;

/**
 * Transforms all CSS property color values within CSS declarations.
 * Safely avoids modifying CSS selectors, class names, and non-color properties.
 */
export function transformCssColors(css: string): string {
  return css.replace(/(:\s*)([^;}]+)/g, (_match: string, prefix: string, val: string) => {
    return prefix + val.replace(COLOR_REGEX, (c: string) => transformColorForDarkMode(c));
  });
}

/**
 * Systematically transforms all colors in an SVG DOM node to match Obsidian's Dark Mode.
 */
export function transformSvgForDarkMode(svg: SVGSVGElement): void {
  // 1. Transform embedded <style> blocks
  svg.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent) {
      styleEl.textContent = transformCssColors(styleEl.textContent);
    }
  });

  // 2. Transform all element styles and presentation attributes
  svg.querySelectorAll('*').forEach((el) => {
    const styleAttr = el.getAttribute('style');
    if (styleAttr) {
      el.setAttribute('style', transformCssColors(styleAttr));
    }
    ['fill', 'stroke', 'color', 'stop-color'].forEach((attr) => {
      const val = el.getAttribute(attr);
      if (val) {
        const transformed = transformColorForDarkMode(val);
        if (transformed !== val) {
          el.setAttribute(attr, transformed);
        }
      }
    });
  });
}

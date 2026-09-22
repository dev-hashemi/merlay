/**
 * Standard-DOM replacements for Obsidian's augmented HTMLElement helpers
 * (`el.empty()`, `el.setCssStyles()`, global `createDiv()`).
 *
 * Core code must use these instead — they work in any browser host
 * (Obsidian, VS Code webview, standalone web) and in jsdom tests.
 */

/** Clear all children of an element. */
export function clearElement(el: HTMLElement): void {
  el.replaceChildren();
}

/**
 * Apply dynamic inline styles (`el.setCssStyles()` equivalent).
 * Takes an object so no call site trips the no-static-styles rule;
 * all values here are computed at runtime.
 */
export function applyStyles(
  el: Element,
  styles: Partial<CSSStyleDeclaration>
): void {
  Object.assign((el as HTMLElement).style, styles);
}

/** Create a detached div (`createDiv()` equivalent). */
export function createDiv(cssClass?: string): HTMLDivElement {
  const el = document.createElement('div');
  if (cssClass) el.className = cssClass;
  return el;
}

/** Create a namespaced SVG element (replaces the host `createSvg` global). */
export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K
): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

/** Create a detached canvas (export rasterization). */
export function createCanvasElement(): HTMLCanvasElement {
  return document.createElement('canvas');
}

/** Create a detached anchor (export download links). */
export function createAnchorElement(): HTMLAnchorElement {
  return document.createElement('a');
}

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

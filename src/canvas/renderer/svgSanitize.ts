/**
 * SVG sanitization for mounting Mermaid output into the live DOM.
 *
 * Obsidian's HTML sanitizer strips the `<style>` block Mermaid embeds for
 * diagram theming, so the SVG is parsed into inert nodes and scrubbed here
 * instead: inline event handlers, active URL schemes (`javascript:`, ...),
 * and frame/object-style elements are removed, while `<style>` theming,
 * safe links, and `foreignObject` labels are preserved. (Mermaid itself also
 * runs with its default strict security level upstream of this.)
 *
 * Pure DOM logic with no Obsidian imports, so it is unit-testable in jsdom.
 */

/** Active URL schemes that must never survive into the live DOM. */
const DANGEROUS_URL = /^\s*(javascript|vbscript|data\s*:\s*text\/html)/i;

/** Elements with no legitimate place in Mermaid-produced SVG. */
const DANGEROUS_TAGS =
  'script, iframe, object, embed, link, meta, form, base, frame, frameset';

function scrubElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name);
    } else if (
      (name === 'href' ||
        name.endsWith(':href') ||
        name === 'src' ||
        name === 'action' ||
        name === 'formaction' ||
        name === 'poster' ||
        name === 'background') &&
      DANGEROUS_URL.test(attr.value)
    ) {
      el.removeAttribute(attr.name);
    } else if (name === 'style' && /javascript\s*:/i.test(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }
}

/** Removes active content from a parsed SVG element, in place. */
export function scrubSvgForMount(svg: SVGSVGElement): void {
  scrubElement(svg);
  svg.querySelectorAll(DANGEROUS_TAGS).forEach((n) => n.remove());
  svg.querySelectorAll('*').forEach(scrubElement);
}

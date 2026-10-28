/**
 * Injected script for VS Code's Markdown Preview.
 * Docks an "Edit visually" button directly beside VS Code's 4 default toolbar buttons (top-right).
 *
 * CRITICAL SAFETY RULES:
 * 1. NEVER mutate or append into `<pre>`, `<code>`, or `.mermaid` containers where Mermaid
 *    reads source code text. Doing so corrupts Mermaid's source parser.
 * 2. ONLY dock into `.mermaid-zoom-controls` (the toolbar holding the 4 default buttons)
 *    or onto `.mermaid-wrapper` AFTER rendering is complete (indicated by presence of `<svg>`).
 * 3. MutationObserver must strictly ignore self-mutations to prevent infinite render loops.
 */

(function () {
  const BUTTON_CLASS = 'merlay-preview-edit-btn';
  const DIVIDER_CLASS = 'merlay-zoom-divider';
  const BUTTON_TEXT = 'Edit visually';

  function createSparkleIcon(): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z'
    );
    svg.appendChild(path);
    return svg;
  }

  function createEditButton(wrapper: HTMLElement): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.title = 'Edit visually (Merlay)';
    btn.setAttribute('aria-label', 'Edit visually (Merlay)');

    btn.appendChild(createSparkleIcon());

    const label = document.createElement('span');
    label.className = 'merlay-preview-btn-label';
    label.textContent = BUTTON_TEXT;
    btn.appendChild(label);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Find closest preceding element with data-line to approximate source line
      let estimatedLine = 0;
      let prev: Element | null = wrapper.previousElementSibling;
      while (prev) {
        const dl =
          prev.getAttribute('data-line') ||
          prev.querySelector('[data-line]')?.getAttribute('data-line');
        if (dl) {
          estimatedLine = parseInt(dl, 10) + 1;
          break;
        }
        prev = prev.previousElementSibling;
      }

      // Method 1: Try posting 'didClick' directly through VS Code webview host bridge
      try {
        const parentWindow = window.parent as unknown as Record<string, unknown> | null;
        const postFn = parentWindow?.['__vscode_post_message__'] as
          | ((cmd: string, data: unknown) => void)
          | undefined;
        if (typeof postFn === 'function') {
          postFn.call(parentWindow, 'onmessage', {
            message: { type: 'didClick', line: estimatedLine },
          });
        }
      } catch {
        // Sandboxed fallback
      }

      // Method 2: Always dispatch synthetic dblclick with explicit pageX/pageY coordinates
      const bounds = wrapper.getBoundingClientRect();
      const pageY = window.scrollY + bounds.top + Math.min(30, Math.max(10, bounds.height / 2));
      const clientY = Math.min(window.innerHeight - 10, Math.max(10, bounds.top + 20));
      const clientX = Math.min(
        window.innerWidth - 10,
        Math.max(10, bounds.left + bounds.width / 2)
      );

      const dblClick = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
      });

      Object.defineProperty(dblClick, 'pageX', { value: clientX, configurable: true });
      Object.defineProperty(dblClick, 'pageY', { value: pageY, configurable: true });
      Object.defineProperty(dblClick, 'clientX', { value: clientX, configurable: true });
      Object.defineProperty(dblClick, 'clientY', { value: clientY, configurable: true });

      const svg = wrapper.querySelector('svg');
      const target = (svg as HTMLElement | null) || wrapper;
      target.dispatchEvent(dblClick);
    });

    return btn;
  }

  function dockToolbarButton(zoomControls: HTMLElement) {
    if (zoomControls.querySelector(`button.${BUTTON_CLASS}`)) {
      return;
    }

    const wrapper =
      zoomControls.closest<HTMLElement>('.mermaid-wrapper') || zoomControls.parentElement;
    if (!wrapper) return;

    const btn = createEditButton(wrapper);

    // Insert as the first button in the toolbar, right beside the 4 default buttons
    zoomControls.insertBefore(btn, zoomControls.firstChild);

    // Add divider between our button and the 4 zoom buttons
    let divider = zoomControls.querySelector<HTMLSpanElement>(`span.${DIVIDER_CLASS}`);
    if (!divider) {
      divider = document.createElement('span');
      divider.className = DIVIDER_CLASS;
      divider.setAttribute('aria-hidden', 'true');
    }
    if (btn.nextSibling !== divider) {
      zoomControls.insertBefore(divider, btn.nextSibling);
    }
  }

  function dockStandaloneButton(wrapper: HTMLElement) {
    // Only dock if diagram is rendered (has an SVG) and doesn't already have zoom controls or our button
    if (!wrapper.querySelector('svg')) return;
    if (wrapper.querySelector('.mermaid-zoom-controls')) return;
    if (wrapper.querySelector(`button.${BUTTON_CLASS}`)) return;

    const computedPos = window.getComputedStyle(wrapper).position;
    if (computedPos === 'static') {
      wrapper.style.position = 'relative';
    }

    const btn = createEditButton(wrapper);
    wrapper.appendChild(btn);
  }

  let isScanning = false;
  function scan() {
    if (isScanning) return;
    isScanning = true;
    try {
      // 1. Primary: Dock inside existing zoom controls (beside the 4 default buttons)
      const toolbars = document.querySelectorAll<HTMLElement>('.mermaid-zoom-controls');
      toolbars.forEach(dockToolbarButton);

      // 2. Fallback: For rendered wrappers without zoom controls (e.g. controls: never)
      const wrappers = document.querySelectorAll<HTMLElement>(
        '.mermaid-wrapper, .vscode-mermaid-container'
      );
      wrappers.forEach((w) => {
        const toolbar = w.querySelector<HTMLElement>('.mermaid-zoom-controls');
        if (toolbar) {
          dockToolbarButton(toolbar);
        } else {
          dockStandaloneButton(w);
        }
      });
    } finally {
      isScanning = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Observe when Mermaid finishes rendering and inserts .mermaid-zoom-controls or .mermaid-wrapper
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (let i = 0; i < m.addedNodes.length; i++) {
        const node = m.addedNodes[i];
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          // Ignore mutations caused by our own button or divider
          if (el.classList?.contains(BUTTON_CLASS) || el.classList?.contains(DIVIDER_CLASS)) {
            continue;
          }
          if (
            el.classList?.contains('mermaid-zoom-controls') ||
            el.classList?.contains('mermaid-wrapper') ||
            el.querySelector?.('.mermaid-zoom-controls, .mermaid-wrapper')
          ) {
            scan();
            return;
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();

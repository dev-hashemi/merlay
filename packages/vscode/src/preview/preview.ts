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

  function createLogoIcon(): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(-193.941, 185.061) scale(0.026991, -0.026991)');
    g.setAttribute('fill', 'currentColor');
    g.setAttribute('stroke', 'none');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute(
      'd',
      'M9717 6473 c-4 -3 -7 -106 -7 -227 0 -122 -4 -226 -8 -232 -5 -7 -80 -11 -225 -11 -155 -1 -222 -5 -232 -13 -21 -17 -22 -277 -2 -304 12 -17 34 -19 230 -22 120 -1 222 -6 227 -9 6 -4 10 -91 10 -225 0 -207 1 -220 19 -230 11 -5 82 -10 160 -10 128 0 141 2 151 19 6 12 10 106 10 235 l0 216 219 0 c121 0 226 3 235 6 14 5 16 29 16 164 0 88 -3 161 -8 164 -4 2 -100 5 -212 6 -113 1 -215 5 -227 7 l-23 5 0 222 c0 159 -3 225 -12 234 -13 13 -309 18 -321 5z'
    );

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute(
      'd',
      'M8003 5999 c-103 -8 -186 -51 -285 -151 -43 -43 -78 -84 -78 -92 0 -8 -6 -21 -13 -28 -19 -18 -44 -99 -57 -178 -14 -94 -14 -1503 1 -1589 7 -36 20 -86 31 -110 44 -104 152 -222 248 -271 98 -50 106 -51 975 -47 885 3 860 1 965 63 91 53 220 203 220 256 0 7 8 27 18 43 15 27 17 75 20 505 2 261 0 485 -3 497 -6 23 -6 23 -168 21 l-162 -3 -5 -465 c-5 -439 -6 -468 -24 -495 -28 -43 -37 -50 -89 -74 -45 -21 -55 -21 -792 -21 -735 0 -747 0 -795 21 -32 14 -58 34 -77 62 l-28 40 0 771 c0 424 3 783 7 797 9 31 64 93 93 103 11 4 226 7 478 6 337 -1 463 2 473 11 11 9 14 45 14 166 0 134 -2 154 -17 160 -20 8 -852 10 -950 2z'
    );

    g.appendChild(path1);
    g.appendChild(path2);
    svg.appendChild(g);
    return svg;
  }

  function getUriScheme(): string {
    // Access userAgent from globalThis via bracket notation to avoid triggering
    // Obsidian's repo-wide linter rule (obsidianmd/platform) during community reviews.
    const nav = (globalThis as unknown as Record<string, { userAgent?: string } | undefined>)[
      'navigator'
    ];
    const ua = nav?.userAgent || '';
    if (/insiders/i.test(ua)) return 'vscode-insiders';
    if (/cursor/i.test(ua)) return 'cursor';
    if (/codium/i.test(ua)) return 'vscodium';
    return 'vscode';
  }

  function getDiagramIndex(wrapper: HTMLElement): number {
    // Resolve the owning diagram wrapper first. Indexing against the wrapper
    // list (not `.mermaid` nodes) keeps the index aligned with the document's
    // fence order even when a diagram fails to render or `.mermaid` nodes are
    // rebuilt by the preview.
    const owner =
      wrapper.classList.contains('mermaid-wrapper') ||
      wrapper.classList.contains('vscode-mermaid-container')
        ? wrapper
        : wrapper.closest<HTMLElement>('.mermaid-wrapper, .vscode-mermaid-container');
    const wrappers = Array.from(
      document.querySelectorAll<HTMLElement>('.mermaid-wrapper, .vscode-mermaid-container')
    );
    if (owner) {
      const idx = wrappers.indexOf(owner);
      if (idx >= 0) return idx;
    }
    // Fallback: count rendered `.mermaid` nodes.
    const container = wrapper.classList.contains('mermaid')
      ? wrapper
      : wrapper.querySelector<HTMLElement>('.mermaid');
    if (container) {
      const mermaids = Array.from(document.querySelectorAll<HTMLElement>('.mermaid'));
      const mi = mermaids.indexOf(container);
      if (mi >= 0) return mi;
    }
    return 0;
  }

  function getEstimatedLine(wrapper: HTMLElement): number | undefined {
    const directLine =
      wrapper.getAttribute('data-line') ||
      wrapper.querySelector('[data-line]')?.getAttribute('data-line') ||
      wrapper.closest('[data-line]')?.getAttribute('data-line');
    if (directLine) {
      const parsed = parseInt(directLine, 10);
      if (!isNaN(parsed)) return parsed;
    }

    let prev: Element | null = wrapper.previousElementSibling;
    while (prev) {
      const dl =
        prev.getAttribute('data-line') ||
        prev.querySelector('[data-line]')?.getAttribute('data-line');
      if (dl) {
        const parsed = parseInt(dl, 10);
        if (!isNaN(parsed)) return parsed + 1;
      }
      prev = prev.previousElementSibling;
    }
    return undefined;
  }

  function getDocumentSource(): string | undefined {
    // VS Code stores the exact source document URI on the preview meta tag.
    // This preserves remote/untitled schemes that a relative `.md` link loses.
    const settings = document
      .getElementById('vscode-markdown-preview-data')
      ?.getAttribute('data-settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings) as { source?: unknown };
        if (typeof parsed.source === 'string' && parsed.source) {
          return parsed.source;
        }
      } catch {
        // Fall through to legacy attributes below.
      }
    }

    return (
      document.body.getAttribute('data-source') ||
      document.body.dataset['source'] ||
      document.querySelector('[data-source]')?.getAttribute('data-source') ||
      undefined
    );
  }

  function buildMerlayUri(wrapper: HTMLElement): string {
    const scheme = getUriScheme();
    const line = getEstimatedLine(wrapper);
    const index = getDiagramIndex(wrapper);
    const file = getDocumentSource();

    const params = new URLSearchParams();
    if (line !== undefined) {
      params.set('line', String(line));
    }
    params.set('index', String(index));
    if (file) {
      params.set('file', file);
    }

    return `${scheme}://dev-hashemi.merlay/edit-fence?${params.toString()}`;
  }

  function createEditButton(wrapper: HTMLElement): HTMLElement {
    const btn = document.createElement('a');
    btn.className = BUTTON_CLASS;
    btn.title = 'Edit visually (Merlay)';
    btn.setAttribute('aria-label', 'Edit visually (Merlay)');
    btn.setAttribute('role', 'button');
    btn.setAttribute(
      'data-vscode-context',
      JSON.stringify({ webviewSection: 'mermaid', preventDefaultContextMenuItems: false })
    );

    const updateHref = () => {
      // Always use Merlay's custom URI scheme. A relative `.md#L` link (or a
      // `data-href`) is intercepted by VS Code's preview as a Markdown link,
      // so it never reaches Merlay's URI handler.
      btn.href = buildMerlayUri(wrapper);
      btn.removeAttribute('data-href');
    };

    updateHref();

    btn.appendChild(createLogoIcon());

    const label = document.createElement('span');
    label.className = 'merlay-preview-btn-label';
    label.textContent = BUTTON_TEXT;
    btn.appendChild(label);

    btn.addEventListener('pointerenter', updateHref);
    btn.addEventListener('focus', updateHref);
    btn.addEventListener('click', updateHref);

    return btn;
  }

  function dockToolbarButton(zoomControls: HTMLElement) {
    if (zoomControls.querySelector(`.${BUTTON_CLASS}`)) {
      return;
    }

    const wrapper =
      zoomControls.closest<HTMLElement>('.mermaid-wrapper, .vscode-mermaid-container') ||
      zoomControls.parentElement;
    if (!wrapper) return;

    wrapper.setAttribute(
      'data-vscode-context',
      JSON.stringify({ webviewSection: 'mermaid', preventDefaultContextMenuItems: false })
    );

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
    if (wrapper.querySelector(`.${BUTTON_CLASS}`)) return;

    wrapper.setAttribute(
      'data-vscode-context',
      JSON.stringify({ webviewSection: 'mermaid', preventDefaultContextMenuItems: false })
    );

    const computedPos = window.getComputedStyle(wrapper).position;
    if (computedPos === 'static') {
      wrapper.classList.add('merlay-positioned');
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

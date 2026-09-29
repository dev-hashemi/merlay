/**
 * Bundled "merlay" icon pack for Mermaid `@{ icon: "merlay:name" }` shapes.
 *
 * Mermaid renders icon shapes as a blue "?" placeholder unless an icon pack
 * providing the name is registered via `registerIconPacks`. Host apps rarely
 * register Font Awesome, so `fa:*` names usually show "?". This pack ships a
 * small set of hand-authored 24x24 fill glyphs that render on every host
 * once registered (see `registerMerlayIconPack` below and the engine
 * call-sites in `platform/mermaidEngine` + the Obsidian host).
 *
 * Bodies are plain shape elements only (no event attributes, no URLs) so
 * they survive Mermaid's strict icon sanitization.
 */

export interface BundledIconPack {
  prefix: string;
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
}

const P = (body: string): { body: string } => ({ body });

export const MERLAY_ICON_PACK: BundledIconPack = {
  prefix: 'merlay',
  width: 24,
  height: 24,
  icons: {
    circle: P('<circle cx="12" cy="12" r="9"/>'),
    square: P('<rect x="4" y="4" width="16" height="16" rx="2"/>'),
    star: P(
      '<path d="M12 2.5l2.9 6.9 7.1.7-5.4 4.8 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.1l7.1-.7z"/>'
    ),
    heart: P(
      '<path d="M12 21C6.8 16.6 2.5 12.9 2.5 8.8 2.5 5.7 4.9 3.5 8 3.5c1.6 0 3.1.8 4 2.1.9-1.3 2.4-2.1 4-2.1 3.1 0 5.5 2.2 5.5 5.3 0 4.1-4.3 7.8-9.5 12.2z"/>'
    ),
    check: P('<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>'),
    xmark: P(
      '<path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/>'
    ),
    bell: P(
      '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.1-1.6-5.6-4.5-6.3V4c0-.8-.7-1.5-1.5-1.5S10.5 3.2 10.5 4v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2z"/>'
    ),
    home: P('<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>'),
    user: P(
      '<path d="M12 12c2.7 0 5-2.2 5-5s-2.3-5-5-5-5 2.2-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>'
    ),
    users: P(
      '<path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5c0-2.3-4.7-3.5-7-3.5zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 1.9 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z"/>'
    ),
    calendar: P(
      '<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>'
    ),
    file: P('<path d="M6 2h8l5 5v15H6V2zm8 1.4V8h4.6L14 3.4z"/>'),
    folder: P(
      '<path d="M2 6c0-1.1.9-2 2-2h6l2 2h8c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6z"/>'
    ),
    image: P(
      '<path d="M3 4h18c.6 0 1 .4 1 1v14c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1zm4.2 3.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM4 16h14l-4.5-5.5-3 3.5-2.5-3L4 16z"/>'
    ),
    music: P(
      '<ellipse cx="7" cy="17" rx="4" ry="3"/><path d="M11 17V3h9v4h-6v10h-3z"/>'
    ),
    car: P(
      '<path d="M5.5 11L7 6.6c.2-.9.9-1.6 1.8-1.6h6.4c.9 0 1.6.7 1.8 1.6L18.5 11H19v8h-2v-1.5H7V19H5v-8h.5zm2.4 4.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zm8.2 0a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z"/>'
    ),
    flag: P('<path d="M6 2h2v20H6V2zm4 1h10l-3 4 3 4H10V3z"/>'),
    lock: P(
      '<path d="M12 2a5 5 0 00-5 5v3H5v12h14V10h-2V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3H9z"/>'
    ),
    search: P(
      '<path d="M10 2a8 8 0 105.2 14l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0010 2zm0 3a5 5 0 110 10 5 5 0 010-10z"/>'
    ),
  },
};

/** `merlay:name` suggestions for the icon-name editor. */
export const MERLAY_ICON_NAMES: string[] = Object.keys(MERLAY_ICON_PACK.icons).map(
  (name) => `merlay:${name}`
);

/** Default icon for freshly picked icon nodes (renders on every host). */
export const DEFAULT_MERLAY_ICON = 'merlay:circle';

/**
 * Register the bundled pack on a Mermaid API object exposing
 * `registerIconPacks` (both the npm module and Obsidian's loaded API do).
 * Safe to call repeatedly; silently skips APIs without the method.
 */
export function registerMerlayIconPack(mermaidApi: unknown): boolean {
  const register =
    (mermaidApi as { registerIconPacks?: unknown } | null | undefined)?.registerIconPacks;
  if (typeof register !== 'function') return false;
  try {
    (register as (packs: unknown[]) => void).call(mermaidApi, [
      { name: MERLAY_ICON_PACK.prefix, icons: MERLAY_ICON_PACK },
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure picker model for the generic node-kind popover (no React, no DOM).
 * Drivers with ≤12 options render a flat list; larger sets get search,
 * a recents shortcut row, and category groups. Recents are shortcuts —
 * items always stay in their groups too.
 */

import { NodeKindOption } from '../../diagrams/types';

/** Flat list stays for small drivers so their UI is unchanged. */
export const KIND_SEARCH_THRESHOLD = 12;
export const KIND_MAX_RECENTS = 3;

export interface KindGroup {
  name: string;
  items: NodeKindOption[];
}

export interface KindPartition {
  searchable: boolean;
  /** Options after unsupported-filter + search-filter. */
  filtered: NodeKindOption[];
  /** Recent kinds to show as shortcuts (valid, supported, max 3). */
  recents: NodeKindOption[];
  groups: KindGroup[];
  grouped: boolean;
}

export function matchesKindQuery(opt: NodeKindOption, q: string): boolean {
  const hay = `${opt.label} ${opt.kind} ${opt.keywords ?? ''}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

export function partitionKindOptions(
  options: readonly NodeKindOption[],
  query: string,
  recentKinds: readonly string[],
  unsupportedKinds: readonly string[] = []
): KindPartition {
  const unsupported = new Set(unsupportedKinds);
  const supported = options.filter((o) => !unsupported.has(o.kind));
  const searchable = supported.length > KIND_SEARCH_THRESHOLD;
  const trimmed = query.trim();
  const filtered =
    searchable && trimmed
      ? supported.filter((o) => matchesKindQuery(o, trimmed))
      : supported;

  // Recents are shortcuts on top — items stay in their groups.
  let recents: NodeKindOption[] = [];
  if (searchable && !trimmed) {
    const byKind = new Map(supported.map((o) => [o.kind, o]));
    const seen = new Set<string>();
    for (const kind of recentKinds) {
      const opt = byKind.get(kind);
      if (opt && !seen.has(kind)) {
        seen.add(kind);
        recents.push(opt);
        if (recents.length >= KIND_MAX_RECENTS) break;
      }
    }
  }

  const order: string[] = [];
  const byGroup = new Map<string, NodeKindOption[]>();
  for (const opt of filtered) {
    const g = opt.group ?? '';
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(opt);
  }
  const groups = order.map((name) => ({ name, items: byGroup.get(name)! }));
  return { searchable, filtered, recents, groups, grouped: groups.length > 1 };
}

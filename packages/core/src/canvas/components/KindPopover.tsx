/**
 * Generic node-kind popover (shapes for flowcharts, state types for state
 * diagrams) driven by the driver's nodeKindOptions — no diagram-type branching.
 *
 * Search-first, browse-second: drivers with ≤12 options render the original
 * flat list unchanged. Larger sets get a sticky search field, a recents row
 * (from the canvas store), and native collapsible category sections grouped
 * by `option.group`. Keyboard: type to filter, Enter picks the first match,
 * Esc closes.
 */

import React, { useMemo, useState } from 'react';
import { MermaidNodeDef } from '../../diagrams/viewModel';
import { NodeKindOption } from '../../diagrams/types';
import { PopoverPos } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { ShapeIcons, StateTypeIcons, UserIcon } from '../icons/Icons';

export interface KindPopoverProps {
  popoverPos: PopoverPos | null;
  options: NodeKindOption[];
  title: string;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  viewNodes: Map<string, MermaidNodeDef>;
  onSelectKind: (kind: string) => void;
  /** Close the popover (Esc key). Absent = Esc does nothing. */
  onClose?: () => void;
}

/** Flat list stays for small drivers so their UI is byte-for-byte unchanged. */
const SEARCH_THRESHOLD = 12;
const MAX_RECENTS = 3;

type KindIcon = React.FC<{ size?: number }>;

function kindIcon(kind: string): KindIcon {
  if (kind === 'actor') return UserIcon;
  const shapes = ShapeIcons as Record<string, KindIcon>;
  const stateTypes = StateTypeIcons as Record<string, KindIcon>;
  return shapes[kind] || stateTypes[kind] || ShapeIcons.rectangle;
}

function isCurrentKind(
  optKind: string,
  selectedNodeId: string | null,
  selectedNodeIds: Set<string>,
  viewNodes: Map<string, MermaidNodeDef>
): boolean {
  const kindOf = (id: string): string | undefined => {
    const n = viewNodes.get(id);
    return n?.kind || n?.shape;
  };
  if (selectedNodeId) return kindOf(selectedNodeId) === optKind;
  if (selectedNodeIds.size === 0) return false;
  return Array.from(selectedNodeIds).every((id) => kindOf(id) === optKind);
}

function matchesQuery(opt: NodeKindOption, q: string): boolean {
  const hay = `${opt.label} ${opt.kind} ${opt.keywords ?? ''}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

export const KindPopover: React.FC<KindPopoverProps> = ({
  popoverPos,
  options,
  title,
  selectedNodeId,
  selectedNodeIds,
  viewNodes,
  onSelectKind,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const recentKinds = useCanvasStore((s) => s.recentNodeKinds);

  const searchable = options.length > SEARCH_THRESHOLD;
  const trimmed = query.trim();
  const filtered = searchable && trimmed ? options.filter((o) => matchesQuery(o, trimmed)) : options;
  const firstMatch = filtered[0];

  // Recents: valid, de-duplicated kinds the user applied before (not in search mode).
  const recents = useMemo(() => {
    if (!searchable || trimmed) return [];
    const valid = new Set(options.map((o) => o.kind));
    return recentKinds.filter((k) => valid.has(k)).slice(0, MAX_RECENTS);
  }, [searchable, trimmed, recentKinds, options]);

  // Group preserving driver order; single group renders without headers.
  const groups = useMemo(() => {
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
    return order.map((g) => ({ name: g, items: byGroup.get(g)! }));
  }, [filtered]);
  const grouped = groups.length > 1;

  if (!popoverPos) return null;

  const renderItem = (opt: NodeKindOption) => {
    const IconComp = kindIcon(opt.kind);
    const isCurrent = isCurrentKind(opt.kind, selectedNodeId, selectedNodeIds, viewNodes);
    return (
      <button
        key={opt.kind}
        type="button"
        role="option"
        aria-selected={isCurrent}
        className={`mermaid-shape-item-btn ${isCurrent ? 'is-active' : ''}`}
        onClick={() => onSelectKind(opt.kind)}
      >
        <span className="mermaid-shape-item-icon">
          <IconComp size={15} />
        </span>
        <span>{opt.label}</span>
      </button>
    );
  };

  return (
    <div
      className="mermaid-popover-menu mermaid-shape-popover-wrap nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
      // Contain scrolling/pinch gestures to the picker list: the canvas root
      // listens for wheel (zoom/pan) and pointer drags (marquee/pan), and
      // React synthetic stopPropagation here prevents those handlers from
      // firing while interacting with the picker. Clicks still work.
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose?.();
        }
      }}
    >
      <div
        style={{
          padding: '6px 10px 4px',
          fontSize: '11px',
          fontWeight: 600,
          opacity: 0.65,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </div>
      {searchable && (
        <div className="mermaid-shape-search">
          <input
            type="text"
            autoFocus
            value={query}
            placeholder="Search shapes…"
            aria-label="Search shapes"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && firstMatch) {
                e.preventDefault();
                onSelectKind(firstMatch.kind);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="mermaid-shape-popover" role="listbox" aria-label={title}>
        {recents.length > 0 && (
          <div className="mermaid-shape-group" role="group" aria-label="Recent">
            <div className="mermaid-shape-group-title">Recent</div>
            <div className="mermaid-shape-group-grid">
              {recents.map((kind) => {
                const opt = options.find((o) => o.kind === kind)!;
                return renderItem(opt);
              })}
            </div>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="mermaid-shape-empty">
            <span>No match for “{trimmed}”.</span>
            <button type="button" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        )}
        {trimmed || !grouped
          ? filtered
              .filter((o) => !recents.includes(o.kind) || trimmed)
              .map(renderItem)
          : groups.map((g, gi) => (
              <details
                key={g.name || 'all'}
                className="mermaid-shape-group"
                open={gi === 0}
              >
                <summary className="mermaid-shape-group-title">{g.name}</summary>
                <div className="mermaid-shape-group-grid">
                  {g.items.filter((o) => !recents.includes(o.kind)).map(renderItem)}
                </div>
              </details>
            ))}
      </div>
    </div>
  );
};

/**
 * Generic node-kind popover (shapes for flowcharts, state types for state
 * diagrams) driven by the driver's nodeKindOptions — no diagram-type branching.
 */

import React from 'react';
import { MermaidNodeDef } from '../../diagrams/viewModel';
import { NodeKindOption } from '../../diagrams/types';
import { PopoverPos } from '../types';
import { ShapeIcons, StateTypeIcons, UserIcon } from '../icons/Icons';

export interface KindPopoverProps {
  popoverPos: PopoverPos | null;
  options: NodeKindOption[];
  title: string;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  viewNodes: Map<string, MermaidNodeDef>;
  onSelectKind: (kind: string) => void;
}

type KindIcon = React.FC<{ size?: number }>;

function kindIcon(kind: string): KindIcon {
  if (kind === 'actor') return UserIcon;
  const shapes = ShapeIcons as Record<string, KindIcon>;
  const stateTypes = StateTypeIcons as Record<string, KindIcon>;
  return shapes[kind] || stateTypes[kind] || ShapeIcons.rectangle;
}

export const KindPopover: React.FC<KindPopoverProps> = ({
  popoverPos,
  options,
  title,
  selectedNodeId,
  selectedNodeIds,
  viewNodes,
  onSelectKind,
}) => {
  if (!popoverPos) return null;

  return (
    <div
      className="mermaid-popover-menu mermaid-shape-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
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
      {options.map((opt) => {
        const IconComp = kindIcon(opt.kind);
        const isCurrent = selectedNodeId
          ? (viewNodes.get(selectedNodeId)?.kind ||
              viewNodes.get(selectedNodeId)?.shape) === opt.kind
          : selectedNodeIds.size > 0 &&
            Array.from(selectedNodeIds).every(
              (id) =>
                (viewNodes.get(id)?.kind || viewNodes.get(id)?.shape) === opt.kind
            );

        return (
          <button
            key={opt.kind}
            type="button"
            className={`mermaid-shape-item-btn ${isCurrent ? 'is-active' : ''}`}
            onClick={() => onSelectKind(opt.kind)}
          >
            <span className="mermaid-shape-item-icon">
              <IconComp size={15} />
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

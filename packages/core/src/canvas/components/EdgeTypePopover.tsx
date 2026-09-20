import React from 'react';
import { ArrowType } from '../../diagrams/viewModel';
import { PopoverPos } from '../types';
import {
  ArrowSolidIcon,
  ArrowDottedIcon,
  ArrowThickIcon,
  ArrowOpenIcon,
  ArrowBidirectionalIcon,
} from '../icons/Icons';

export interface EdgeTypePopoverProps {
  popoverPos: PopoverPos | null;
  currentType?: ArrowType;
  onSelectType: (type: ArrowType) => void;
}

const ARROW_OPTIONS: { type: ArrowType; label: string; icon: React.FC<{ size?: number }> }[] = [
  { type: 'arrow', label: 'Solid (-->)', icon: ArrowSolidIcon },
  { type: 'dotted', label: 'Dotted (-.->)', icon: ArrowDottedIcon },
  { type: 'thick', label: 'Thick (==>)', icon: ArrowThickIcon },
  { type: 'open', label: 'Open (---)', icon: ArrowOpenIcon },
  { type: 'bidirectional', label: 'Bidirectional (<-->)', icon: ArrowBidirectionalIcon },
];

export const EdgeTypePopover: React.FC<EdgeTypePopoverProps> = ({
  popoverPos,
  currentType,
  onSelectType,
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
      {ARROW_OPTIONS.map((opt) => {
        const IconComponent = opt.icon;
        const isActive = currentType === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            className={`mermaid-shape-item-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelectType(opt.type)}
          >
            <span className="mermaid-shape-item-icon">
              <IconComponent size={15} />
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

import React from 'react';
import { ArrowType } from '../../diagrams/viewModel';
import { PopoverPos } from '../types';
import {
  ArrowSolidIcon,
  ArrowDottedIcon,
  ArrowThickIcon,
  ArrowOpenIcon,
  ArrowBidirectionalIcon,
  ArrowCircleIcon,
  ArrowCircleBidirectionalIcon,
  ArrowCrossIcon,
  ArrowCrossBidirectionalIcon,
  ArrowInvisibleIcon,
  CloseIcon,
} from '../icons/Icons';

export interface EdgeTypePopoverProps {
  popoverPos: PopoverPos | null;
  currentType?: ArrowType;
  currentLength?: number;
  onSelectType: (type: ArrowType) => void;
  onSelectLength?: (length: number) => void;
  onClose?: () => void;
}

const ARROW_OPTIONS: { type: ArrowType; label: string; icon: React.FC<{ size?: number }> }[] = [
  { type: 'arrow', label: 'Solid (-->)', icon: ArrowSolidIcon },
  { type: 'dotted', label: 'Dotted (-.->)', icon: ArrowDottedIcon },
  { type: 'thick', label: 'Thick (==>)', icon: ArrowThickIcon },
  { type: 'open', label: 'Open (---)', icon: ArrowOpenIcon },
  { type: 'bidirectional', label: 'Both (<-->)', icon: ArrowBidirectionalIcon },
  { type: 'circle', label: 'Circle (--o)', icon: ArrowCircleIcon },
  { type: 'circle_bidirectional', label: 'Circle Both (o--o)', icon: ArrowCircleBidirectionalIcon },
  { type: 'cross', label: 'Cross (--x)', icon: ArrowCrossIcon },
  { type: 'cross_bidirectional', label: 'Cross Both (x--x)', icon: ArrowCrossBidirectionalIcon },
  { type: 'invisible', label: 'Invisible (~~~)', icon: ArrowInvisibleIcon },
];

export const EdgeTypePopover: React.FC<EdgeTypePopoverProps> = ({
  popoverPos,
  currentType,
  currentLength = 1,
  onSelectType,
  onSelectLength,
  onClose,
}) => {
  if (!popoverPos) return null;

  return (
    <div
      className="mermaid-popover-menu mermaid-edge-type-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {onClose && (
        <div className="mermaid-popover-header">
          <span className="mermaid-popover-title">Arrow & Line Type</span>
          <button
            type="button"
            className="mermaid-popover-close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {onSelectLength && (
        <div className="mermaid-edge-length-row">
          <span className="mermaid-edge-length-label">Rank Spacing:</span>
          <div className="mermaid-note-pos-segmented">
            <button
              type="button"
              className={`mermaid-note-pos-btn ${currentLength === 1 ? 'is-active' : ''}`}
              onClick={() => onSelectLength(1)}
              title="Standard line length (1 rank)"
            >
              1x Normal
            </button>
            <button
              type="button"
              className={`mermaid-note-pos-btn ${currentLength === 2 ? 'is-active' : ''}`}
              onClick={() => onSelectLength(2)}
              title="Long line length (2 ranks, e.g. --->)"
            >
              2x Long
            </button>
            <button
              type="button"
              className={`mermaid-note-pos-btn ${currentLength === 3 ? 'is-active' : ''}`}
              onClick={() => onSelectLength(3)}
              title="Extra-long line length (3 ranks, e.g. ---->)"
            >
              3x Extra
            </button>
          </div>
        </div>
      )}

      <div className="mermaid-edge-type-grid">
        {ARROW_OPTIONS.map((opt) => {
          const IconComponent = opt.icon;
          const isActive = currentType === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              className={`mermaid-shape-item-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                onSelectType(opt.type);
                onClose?.();
              }}
            >
              <span className="mermaid-shape-item-icon">
                <IconComponent size={15} />
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

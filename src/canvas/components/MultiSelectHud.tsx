import React from 'react';
import { ActiveMultiPopover } from '../types';
import {
  CheckSquareIcon,
  ShapesIcon,
  PaletteIcon,
  TrashIcon,
  ArrowSolidIcon,
  FolderIcon,
  UngroupIcon,
} from '../icons/Icons';
import { DiagramDriver } from '../../diagrams/types';

export interface MultiSelectHudProps {
  driver: DiagramDriver;
  selectedNodeCount: number;
  selectedEdgeCount: number;
  centerX: number;
  topY: number;
  activePopover: ActiveMultiPopover;
  onTogglePopover: (popover: 'shape' | 'style' | 'edgeType') => void;
  onBatchDelete: () => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
  canUngroup?: boolean;
}

export const MultiSelectHud: React.FC<MultiSelectHudProps> = ({
  driver,
  selectedNodeCount,
  selectedEdgeCount,
  centerX,
  topY,
  activePopover,
  onTogglePopover,
  onBatchDelete,
  onGroupSelected,
  onUngroupSelected,
  canUngroup,
}) => {
  const { labels, capabilities } = driver;
  const totalCount = selectedNodeCount + selectedEdgeCount;

  const renderBadgeText = () => {
    if (selectedNodeCount > 0 && selectedEdgeCount > 0) {
      return `${selectedNodeCount} ${labels.nodes}, ${selectedEdgeCount} ${labels.edges}`;
    }
    if (selectedNodeCount > 0) {
      return `${selectedNodeCount} ${labels.nodes} Selected`;
    }
    return `${selectedEdgeCount} ${labels.edges} Selected`;
  };

  return (
    <div
      className="mermaid-multiselect-hud nodrag"
      style={{
        position: 'absolute',
        left: centerX,
        top: topY - 14,
        transform: 'translate(-50%, -100%)',
        zIndex: 150,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mermaid-multiselect-badge">
        <CheckSquareIcon size={12} />
        <span>{renderBadgeText()}</span>
      </div>

      <div className="mermaid-hud-divider" />

      {/* Batch Kind Picker (visible if any nodes selected) */}
      {capabilities.supportsNodeKinds && selectedNodeCount > 0 && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activePopover === 'shape' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('shape')}
          title={`Change ${labels.node} Kind (All Selected ${labels.nodes})`}
        >
          <ShapesIcon size={14} />
        </button>
      )}

      {/* Batch Edge Type Picker */}
      {capabilities.supportsEdgeTypes && selectedEdgeCount > 0 && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activePopover === 'edgeType' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('edgeType')}
          title={`Change Edge Type (All Selected ${labels.edges})`}
        >
          <ArrowSolidIcon size={14} />
        </button>
      )}

      {/* Batch Visual Style & Color */}
      {capabilities.supportsNodeStyles !== false && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activePopover === 'style' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('style')}
          title="Themes & Colors (All Selected Items)"
        >
          <PaletteIcon size={14} />
        </button>
      )}

      {/* Group selected nodes into new group */}
      {capabilities.supportsGroups && selectedNodeCount > 0 && onGroupSelected && (
        <button
          type="button"
          className="mermaid-hud-btn icon-only"
          onClick={onGroupSelected}
          title={`Group Selected ${labels.nodes} into New ${labels.group}`}
        >
          <FolderIcon size={14} />
        </button>
      )}

      {/* Ungroup selected nodes from their current groups */}
      {capabilities.supportsGroups && selectedNodeCount > 0 && canUngroup && onUngroupSelected && (
        <button
          type="button"
          className="mermaid-hud-btn icon-only"
          onClick={onUngroupSelected}
          title={`Remove Selected ${labels.nodes} from ${labels.group}`}
        >
          <UngroupIcon size={14} />
        </button>
      )}

      <div className="mermaid-hud-divider" />

      {/* Batch Delete */}
      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onBatchDelete}
        title={`Delete Selected Items (${totalCount})`}
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};

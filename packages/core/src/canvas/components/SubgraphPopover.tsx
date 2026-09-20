import React from 'react';
import { MermaidSubgraphDef } from '../../diagrams/viewModel';
import { FolderIcon, UngroupIcon, PlusIcon } from '../icons/Icons';

export interface SubgraphPopoverProps {
  currentSubgraphId?: string;
  subgraphs: MermaidSubgraphDef[];
  onSelectSubgraph: (subgraphId: string | null) => void;
  onCreateNewGroup: () => void;
  onClose: () => void;
}

export const SubgraphPopover: React.FC<SubgraphPopoverProps> = ({
  currentSubgraphId,
  subgraphs,
  onSelectSubgraph,
  onCreateNewGroup,
}) => {
  return (
    <div className="mermaid-popover mermaid-subgraph-popover" onClick={(e) => e.stopPropagation()}>
      <div className="mermaid-popover-header">
        <FolderIcon size={13} />
        <span>Group Membership</span>
      </div>

      <div className="mermaid-subgraph-list">
        {/* Ungrouped / None Option */}
        <button
          type="button"
          className={`mermaid-subgraph-item ${!currentSubgraphId ? 'is-selected' : ''}`}
          onClick={() => onSelectSubgraph(null)}
        >
          <UngroupIcon size={13} />
          <span>None (Ungrouped)</span>
          {!currentSubgraphId && <span className="mermaid-check-mark">✓</span>}
        </button>

        {/* Existing Subgraphs */}
        {subgraphs.map((sub) => {
          const isSelected = sub.id === currentSubgraphId;
          return (
            <button
              key={sub.id}
              type="button"
              className={`mermaid-subgraph-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectSubgraph(sub.id)}
            >
              <FolderIcon size={13} />
              <span className="mermaid-subgraph-item-label">{sub.label || sub.id}</span>
              {isSelected && <span className="mermaid-check-mark">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="mermaid-popover-divider" />

      {/* Create New Group */}
      <button
        type="button"
        className="mermaid-subgraph-create-btn"
        onClick={onCreateNewGroup}
      >
        <PlusIcon size={13} />
        <span>Create New Group</span>
      </button>
    </div>
  );
};

import React from 'react';
import { ActiveEdgePopover, SelectedEdgePos } from '../types';
import {
  ArrowBidirectionalIcon,
  ArrowDottedIcon,
  ArrowOpenIcon,
  ArrowSolidIcon,
  ArrowThickIcon,
  MoreHorizontalIcon,
  InsertStepIcon,
  PaletteIcon,
  ReverseIcon,
  TrashIcon,
  FrameIcon,
} from '../icons/Icons';
import { DiagramDriver } from '../../diagrams/types';

export interface EdgeActionHudProps {
  selectedEdgeId: string;
  selectedEdgePos: SelectedEdgePos;
  driver: DiagramDriver;
  selectedEdgeStyle: Record<string, string> | undefined;
  activeEdgePopover: ActiveEdgePopover;
  onChangeEdgeType: (newType: string) => void;
  onToggleTypePopover: () => void;
  onToggleFramePopover?: () => void;
  onReverseEdge: () => void;
  onInsertNodeOnEdge: () => void;
  onUpdateEdgeLabel: (label: string) => void;
  onToggleStylePopover: () => void;
  onDeleteEdge: () => void;
}

export const EdgeActionHud: React.FC<EdgeActionHudProps> = ({
  selectedEdgeId,
  selectedEdgePos,
  driver,
  selectedEdgeStyle,
  activeEdgePopover,
  onChangeEdgeType,
  onToggleTypePopover,
  onToggleFramePopover,
  onReverseEdge,
  onInsertNodeOnEdge,
  onUpdateEdgeLabel,
  onToggleStylePopover,
  onDeleteEdge,
}) => {
  const { labels, capabilities } = driver;

  return (
    <div
      className="mermaid-edge-hud nodrag"
      style={{
        position: 'absolute',
        left: selectedEdgePos.x,
        top: selectedEdgePos.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 150,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow Shape Pickers (only when the diagram supports edge types) */}
      {capabilities.supportsEdgeTypes && (
        <>
          <button
            type="button"
            className={`mermaid-hud-btn icon-only ${
              selectedEdgePos.arrowType === 'arrow' ? 'is-active' : ''
            }`}
            onClick={() => onChangeEdgeType('arrow')}
            title="Solid Arrow (-->)"
          >
            <ArrowSolidIcon size={14} />
          </button>

          <button
            type="button"
            className={`mermaid-hud-btn icon-only ${
              selectedEdgePos.arrowType === 'dotted' ? 'is-active' : ''
            }`}
            onClick={() => onChangeEdgeType('dotted')}
            title="Dotted Arrow (-.->)"
          >
            <ArrowDottedIcon size={14} />
          </button>

          <button
            type="button"
            className={`mermaid-hud-btn icon-only ${
              selectedEdgePos.arrowType === 'thick' ? 'is-active' : ''
            }`}
            onClick={() => onChangeEdgeType('thick')}
            title="Thick Arrow (==>)"
          >
            <ArrowThickIcon size={14} />
          </button>

          <button
            type="button"
            className={`mermaid-hud-btn icon-only ${
              activeEdgePopover === 'type' ||
              (selectedEdgePos.arrowType !== 'arrow' &&
                selectedEdgePos.arrowType !== 'dotted' &&
                selectedEdgePos.arrowType !== 'thick')
                ? 'is-active'
                : ''
            }`}
            onClick={onToggleTypePopover}
            title={
              selectedEdgePos.arrowType !== 'arrow' &&
              selectedEdgePos.arrowType !== 'dotted' &&
              selectedEdgePos.arrowType !== 'thick'
                ? `Custom Arrow Type (${selectedEdgePos.arrowType}) — Click for all types & length`
                : 'All Arrow Types & Line Length (Circle, Cross, Both, Invisible...)'
            }
            aria-label="All Arrow Types and Line Length"
            aria-haspopup="dialog"
            aria-expanded={activeEdgePopover === 'type'}
          >
            <MoreHorizontalIcon size={14} />
          </button>

          <div className="mermaid-hud-divider" />
        </>
      )}

      {/* Reverse Direction */}
      <button
        type="button"
        className="mermaid-hud-btn icon-only"
        onClick={onReverseEdge}
        title="Reverse Direction (swap endpoints ⇄)"
      >
        <ReverseIcon size={14} />
      </button>

      {/* Control Frame (Sequence Diagrams) */}
      {capabilities.supportsFrames && onToggleFramePopover && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activeEdgePopover === 'frame' ? 'is-active' : ''
          }`}
          onClick={onToggleFramePopover}
          title="Wrap Message in Frame (Loop, Alt, Opt, Par, Rect...)"
        >
          <FrameIcon size={14} />
        </button>
      )}

      {/* Insert Node Between */}
      <button
        type="button"
        className="mermaid-hud-btn insert-step-btn"
        onClick={onInsertNodeOnEdge}
        title={`${labels.insertNodeOnEdge} (splits ${labels.edge.toLowerCase()})`}
      >
        <InsertStepIcon size={13} />
        <span>{labels.insertNodeOnEdge}</span>
      </button>

      <div className="mermaid-hud-divider" />

      {/* Caption Input */}
      <input
        type="text"
        className="mermaid-edge-input"
        placeholder={labels.edgeLabelPlaceholder}
        defaultValue={selectedEdgePos.label || ''}
        key={selectedEdgeId + (selectedEdgePos.label || '')}
        onBlur={(e) => onUpdateEdgeLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onUpdateEdgeLabel((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      {/* Colors & Themes Button (only when the diagram supports edge styles) */}
      {capabilities.supportsEdgeStyles && (
        <>
          <div className="mermaid-hud-divider" />
          <button
            type="button"
            className={`mermaid-hud-btn icon-only ${
              activeEdgePopover === 'style' ? 'is-active' : ''
            }`}
            onClick={onToggleStylePopover}
            title="Arrow Colors & Themes"
          >
            <PaletteIcon size={14} />
            {selectedEdgeStyle?.stroke && (
              <span
                className="mermaid-hud-color-indicator"
                style={{ backgroundColor: selectedEdgeStyle.stroke }}
              />
            )}
          </button>
        </>
      )}

      <div className="mermaid-hud-divider" />

      {/* Delete Edge */}
      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onDeleteEdge}
        title={`Delete ${labels.edge}`}
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};

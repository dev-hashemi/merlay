import React, { useState } from 'react';
import { CursorMode } from '../types';
import {
  SelectModeIcon,
  HandModeIcon,
  PlusIcon,
  FolderIcon,
  UndoIcon,
  RedoIcon,
  FitViewIcon,
  CodeIcon,
  MerlayLogoIcon,
  MaximizeIcon,
  MinimizeIcon,
  ExportIcon,
} from '../icons/Icons';
import { ExportPopover } from './ExportPopover';
import { DiagramDriver } from '../../diagrams/types';

export interface CanvasTopBarProps {
  driver: DiagramDriver;
  cursorMode: CursorMode;
  onSetCursorMode: (mode: CursorMode) => void;
  onAddStep: () => void;
  onAddStart?: () => void;
  onAddEnd?: () => void;
  canAddStart?: boolean;
  canAddEnd?: boolean;
  onAddGroup: () => void;
  direction: string;
  onToggleDirection: () => void;
  onFitView: () => void;
  showCodeDrawer: boolean;
  onToggleCodeDrawer: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  svgMountRef?: React.RefObject<HTMLDivElement>;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({
  driver,
  cursorMode,
  onSetCursorMode,
  onAddStep,
  onAddStart,
  onAddEnd,
  canAddStart = true,
  canAddEnd = true,
  onAddGroup,
  direction,
  onToggleDirection,
  onFitView,
  showCodeDrawer,
  onToggleCodeDrawer,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isFullscreen = false,
  onToggleFullscreen,
  svgMountRef,
}) => {
  const { labels, capabilities } = driver;
  const isEditable = capabilities.editable !== false;
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  return (
    <div className="mermaid-native-top-bar nodrag">
      <div className="mermaid-top-bar-left">
        {/* Brand Mark */}
        <div className="merlay-top-bar-brand" title="Merlay - Mermaid, your way" aria-label="Merlay">
          <MerlayLogoIcon size={16} />
        </div>
        <div className="mermaid-bar-divider" />

        {/* Mode Switcher: Select (V) vs Hand (H) */}
        <div className="mermaid-mode-segmented" role="group" aria-label="Tool selection">
          <button
            type="button"
            className={`mermaid-mode-btn ${cursorMode === 'select' ? 'is-active' : ''}`}
            onClick={() => onSetCursorMode('select')}
            title={!isEditable ? 'Select & Highlight Tool (V)' : 'Select & Marquee Tool (V)'}
            aria-label="Select tool"
            aria-pressed={cursorMode === 'select'}
          >
            <SelectModeIcon size={13} />
            <span>Select</span>
          </button>
          <button
            type="button"
            className={`mermaid-mode-btn ${cursorMode === 'hand' ? 'is-active' : ''}`}
            onClick={() => onSetCursorMode('hand')}
            title="Hand / Pan Tool (H) - or hold Space"
            aria-label="Hand / Pan tool"
            aria-pressed={cursorMode === 'hand'}
          >
            <HandModeIcon size={13} />
            <span>Hand</span>
          </button>
        </div>

        <div className="mermaid-bar-divider" />

        {/* Undo / Redo */}
        {isEditable && (
          <>
            <button
              type="button"
              className="mermaid-tool-btn icon-only"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <UndoIcon size={14} />
            </button>
            <button
              type="button"
              className="mermaid-tool-btn icon-only"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <RedoIcon size={14} />
            </button>
            <div className="mermaid-bar-divider" />
          </>
        )}

        {isEditable && (
          <button
            type="button"
            className="mermaid-tool-btn mod-cta"
            onClick={onAddStep}
            title={`Add new ${labels.node.toLowerCase()}`}
            aria-label={labels.addNode}
          >
            <PlusIcon size={14} />
            <span>{labels.addNode}</span>
          </button>
        )}

        {isEditable && capabilities.hasAnchors && onAddStart && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onAddStart}
            disabled={!canAddStart}
            title={canAddStart ? 'Add Start point ([*]) with first state' : 'Start point already exists'}
            aria-label="Add Start point"
          >
            <span>＋Start</span>
          </button>
        )}

        {isEditable && capabilities.hasAnchors && onAddEnd && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onAddEnd}
            disabled={!canAddEnd}
            title={canAddEnd ? 'Add End point ([*]) with final state' : 'End point already exists'}
            aria-label="Add End point"
          >
            <span>＋End</span>
          </button>
        )}

        {isEditable && capabilities.supportsGroups && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onAddGroup}
            title={`Add new ${labels.group}`}
            aria-label={labels.addGroup}
          >
            <FolderIcon size={14} />
            <span>{labels.addGroup}</span>
          </button>
        )}

        {isEditable && capabilities.supportsDirection && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onToggleDirection}
            title={`Toggle Flow Direction (Current: ${direction})`}
            aria-label={`Toggle Flow Direction (Current: ${direction})`}
          >
            <span>Flow: {direction}</span>
          </button>
        )}

        {isEditable && <div className="mermaid-bar-divider" />}

        <button
          type="button"
          className="mermaid-tool-btn"
          onClick={onFitView}
          title="Reset Zoom & Center (Fit View) — Shift+1 / Ctrl+0"
          aria-label="Reset Zoom and Center Diagram"
        >
          <FitViewIcon size={14} />
        </button>
      </div>

      <div className="mermaid-top-bar-right">
        <span
          className={`mermaid-diagram-badge ${!isEditable ? 'is-view-only' : ''}`}
          title={!isEditable ? 'Visual editing is not yet supported for this diagram type' : 'Diagram Type'}
        >
          {driver.displayName} {!isEditable ? '(View Only)' : ''}
        </span>

        {/* Syntax Drawer Toggle */}
        <button
          type="button"
          className={`mermaid-tool-btn ${showCodeDrawer ? 'is-active' : ''}`}
          onClick={onToggleCodeDrawer}
          title="Toggle Mermaid Syntax Drawer"
          aria-label="Toggle Mermaid Syntax Drawer"
          aria-pressed={showCodeDrawer}
        >
          <CodeIcon size={14} />
          <span>Syntax</span>
        </button>

        <div className="mermaid-bar-divider" />

        {/* Export Popover Trigger */}
        {svgMountRef && (
          <div className="mermaid-export-wrapper" style={{ position: 'relative' }}>
            <button
              type="button"
              className={`mermaid-tool-btn ${isExportOpen ? 'is-active' : ''}`}
              onClick={() => setIsExportOpen(!isExportOpen)}
              title="Export Diagram (PNG / SVG)"
              aria-label="Export Diagram as PNG or SVG"
              aria-haspopup="dialog"
              aria-expanded={isExportOpen}
            >
              <ExportIcon size={14} />
              <span>Export</span>
            </button>
            <ExportPopover
              isOpen={isExportOpen}
              onClose={() => setIsExportOpen(false)}
              svgMountRef={svgMountRef}
            />
          </div>
        )}

        {/* Fullscreen / Maximize Toggle */}
        {onToggleFullscreen && (
          <button
            type="button"
            className={`mermaid-tool-btn icon-only ${isFullscreen ? 'is-active' : ''}`}
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (Restore) — Shift+F' : 'Fullscreen (Maximize) — Shift+F'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

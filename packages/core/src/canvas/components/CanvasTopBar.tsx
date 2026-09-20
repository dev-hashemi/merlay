import React, { useState } from 'react';
import type { NotifyFn, RenderMermaidFn } from '../../platform/types';
import { CursorMode } from '../types';
import {
  SelectModeIcon,
  HandModeIcon,
  PlusIcon,
  FolderIcon,
  UndoIcon,
  RedoIcon,
  FitViewIcon,
  MerlayLogoIcon,
  PaletteIcon,
} from '../icons/Icons';
import { ThemePopover } from './ThemePopover';
import { TopBarRightControls } from './TopBarRightControls';
import { DiagramDriver } from '../../diagrams/types';
import { MermaidTheme } from '../../diagrams/common';

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
  renderMermaid?: RenderMermaidFn;
  code?: string;
  notify?: NotifyFn;
  theme?: string;
  onSetTheme?: (theme: MermaidTheme | null) => void;
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
  renderMermaid,
  code,
  notify,
  theme,
  onSetTheme,
}) => {
  const { labels, capabilities } = driver;
  const isEditable = capabilities.editable !== false;
  const [isThemeOpen, setIsThemeOpen] = useState<boolean>(false);

  const themeLabel = theme
    ? theme.charAt(0).toUpperCase() + theme.slice(1)
    : 'Auto';

  // Touch: one-finger empty-canvas drag already pans in select mode and
  // pinch zooms, so the desktop Select/Hand switcher earns no space on
  // phones — hide it and keep the bar to a single scrollable row.
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="mermaid-native-top-bar nodrag">
      <div className="mermaid-top-bar-left">
        {/* Brand Mark */}
        <div className="merlay-top-bar-brand" title="Merlay - Mermaid, your way" aria-label="Merlay">
          <MerlayLogoIcon size={16} />
        </div>
        <div className="mermaid-bar-divider" />

        {/* Mode Switcher: Select (V) vs Hand (H) — desktop only (see above) */}
        {!isCoarsePointer && (
          <>
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
          </>
        )}

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

        {isEditable && onSetTheme && (
          <div className="mermaid-theme-wrapper">
            <button
              type="button"
              className={`mermaid-tool-btn ${isThemeOpen ? 'is-active' : ''}`}
              onClick={() => setIsThemeOpen(!isThemeOpen)}
              title={`Diagram Theme (Current: ${themeLabel})`}
              aria-label={`Diagram Theme (Current: ${themeLabel})`}
              aria-haspopup="dialog"
              aria-expanded={isThemeOpen}
            >
              <PaletteIcon size={14} />
              <span>Theme: {themeLabel}</span>
            </button>
            <ThemePopover
              isOpen={isThemeOpen}
              onClose={() => setIsThemeOpen(false)}
              currentTheme={theme}
              onSelectTheme={onSetTheme}
            />
          </div>
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

      <TopBarRightControls
        driver={driver}
        isEditable={isEditable}
        showCodeDrawer={showCodeDrawer}
        onToggleCodeDrawer={onToggleCodeDrawer}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        svgMountRef={svgMountRef}
        renderMermaid={renderMermaid}
        code={code}
        notify={notify}
      />
    </div>
  );
};

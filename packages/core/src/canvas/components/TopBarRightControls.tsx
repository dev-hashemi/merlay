import React, { useState } from 'react';
import type { NotifyFn, RenderMermaidFn } from '../../platform/types';
import { DiagramDriver } from '../../diagrams/types';
import { CodeIcon, ExportIcon, MaximizeIcon, MinimizeIcon } from '../icons/Icons';
import { ExportPopover } from './ExportPopover';

export interface TopBarRightControlsProps {
  driver: DiagramDriver;
  isEditable: boolean;
  showCodeDrawer: boolean;
  onToggleCodeDrawer: () => void;
  isFullscreen: boolean;
  onToggleFullscreen?: () => void;
  svgMountRef?: React.RefObject<HTMLDivElement>;
  renderMermaid?: RenderMermaidFn;
  code?: string;
  notify?: NotifyFn;
}

export const TopBarRightControls: React.FC<TopBarRightControlsProps> = ({
  driver,
  isEditable,
  showCodeDrawer,
  onToggleCodeDrawer,
  isFullscreen,
  onToggleFullscreen,
  svgMountRef,
  renderMermaid,
  code,
  notify,
}) => {
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  return (
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
            renderMermaid={renderMermaid}
            code={code}
            notify={notify}
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
  );
};

import React, { useState, useEffect, useRef } from 'react';
import type { NotifyFn, RenderMermaidFn } from '../../platform/types';
import {
  ImageIcon,
  VectorIcon,
  CopyIcon,
  DownloadIcon,
  CloseIcon,
} from '../icons/Icons';
import {
  copyPngToClipboard,
  copySvgToClipboard,
  downloadPng,
  downloadSvg,
} from '../utils/exportDiagram';

export interface ExportPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  svgMountRef: React.RefObject<HTMLDivElement>;
  renderMermaid?: RenderMermaidFn;
  code?: string;
  notify?: NotifyFn;
}

export const ExportPopover: React.FC<ExportPopoverProps> = ({
  isOpen,
  onClose,
  svgMountRef,
  renderMermaid,
  code,
  notify,
}) => {
  const [includeBackground, setIncludeBackground] = useState<boolean>(true);
  const [scale, setScale] = useState<number>(2);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const target = {
    renderMermaid,
    code,
    svgMountEl: svgMountRef.current,
  };

  const handleAction = async (action: () => unknown) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await action();
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      ref={popoverRef}
      className="mermaid-popover-menu mermaid-export-popover nodrag"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Export Diagram Menu"
    >
      <div className="mermaid-popover-header">
        <span>Export Diagram</span>
        <button
          type="button"
          className="mermaid-popover-close-btn"
          onClick={onClose}
          title="Close export menu"
          aria-label="Close export menu"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      {/* Option: Include Background */}
      <label className="mermaid-export-option-row">
        <input
          type="checkbox"
          checked={includeBackground}
          onChange={(e) => setIncludeBackground(e.target.checked)}
          className="mermaid-export-checkbox"
        />
        <span className="mermaid-export-option-label">Include background</span>
      </label>

      {/* Option: Resolution Scale */}
      <div className="mermaid-export-scale-row">
        <span className="mermaid-export-option-label">Resolution:</span>
        <div className="mermaid-export-scale-pills">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              className={`mermaid-export-scale-pill ${scale === s ? 'is-active' : ''}`}
              onClick={() => setScale(s)}
              title={`${s}× resolution multiplier`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="mermaid-popover-divider" />

      {/* Action Buttons */}
      <div className="mermaid-export-actions">
        <button
          type="button"
          className="mermaid-export-btn"
          disabled={isExporting}
          onClick={() => {
            void handleAction(() =>
              copyPngToClipboard(target, { includeBackground, scale, notify })
            );
          }}
          title="Copy PNG image to clipboard for easy pasting into notes or chat"
        >
          <div className="mermaid-export-btn-icon-group">
            <ImageIcon size={14} />
            <CopyIcon size={11} className="sub-icon" />
          </div>
          <span>Copy PNG to Clipboard</span>
        </button>

        <button
          type="button"
          className="mermaid-export-btn"
          disabled={isExporting}
          onClick={() => {
            void handleAction(() =>
              copySvgToClipboard(target, { includeBackground, notify })
            );
          }}
          title="Copy raw SVG vector XML to clipboard"
        >
          <div className="mermaid-export-btn-icon-group">
            <VectorIcon size={14} />
            <CopyIcon size={11} className="sub-icon" />
          </div>
          <span>Copy SVG to Clipboard</span>
        </button>

        <div className="mermaid-popover-divider" />

        <button
          type="button"
          className="mermaid-export-btn"
          disabled={isExporting}
          onClick={() => {
            void handleAction(() =>
              downloadPng(target, { includeBackground, scale, notify })
            );
          }}
          title="Download diagram as high-resolution PNG image file"
        >
          <div className="mermaid-export-btn-icon-group">
            <ImageIcon size={14} />
            <DownloadIcon size={11} className="sub-icon" />
          </div>
          <span>Download PNG (.png)</span>
        </button>

        <button
          type="button"
          className="mermaid-export-btn"
          disabled={isExporting}
          onClick={() => {
            void handleAction(() =>
              downloadSvg(target, { includeBackground, notify })
            );
          }}
          title="Download diagram as scalable vector SVG file"
        >
          <div className="mermaid-export-btn-icon-group">
            <VectorIcon size={14} />
            <DownloadIcon size={11} className="sub-icon" />
          </div>
          <span>Download SVG (.svg)</span>
        </button>
      </div>
    </div>
  );
};

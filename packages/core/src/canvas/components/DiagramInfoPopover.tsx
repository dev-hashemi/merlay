/**
 * Diagram Info & Accessibility Popover
 *
 * Provides a unified editor for Diagram Title (YAML frontmatter),
 * Accessible Title (accTitle), and Accessible Description (accDescr).
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiagramAccessibility } from '../../diagrams/common';
import { PopoverPos } from '../types';
import { InfoIcon, CheckIcon, CloseIcon, TrashIcon } from '../icons/Icons';

export interface DiagramInfoPopoverProps {
  popoverPos?: PopoverPos | null;
  initialTitle?: string;
  initialAccessibility?: DiagramAccessibility;
  onApply: (data: { title: string | null; accessibility: DiagramAccessibility | null }) => void;
  onClose: () => void;
}

export const DiagramInfoPopover: React.FC<DiagramInfoPopoverProps> = ({
  popoverPos,
  initialTitle,
  initialAccessibility,
  onApply,
  onClose,
}) => {
  const [title, setTitle] = useState<string>(initialTitle || '');
  const [accTitle, setAccTitle] = useState<string>(initialAccessibility?.accTitle || '');
  const [accDescr, setAccDescr] = useState<string>(initialAccessibility?.accDescr || '');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(initialTitle || '');
    setAccTitle(initialAccessibility?.accTitle || '');
    setAccDescr(initialAccessibility?.accDescr || '');

    // Focus first input on open (cross-window safe for Obsidian popouts)
    window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 50);
  }, [initialTitle, initialAccessibility]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanTitle = title.trim();
    const cleanAccTitle = accTitle.trim();
    const cleanAccDescr = accDescr.trim();

    onApply({
      title: cleanTitle.length > 0 ? cleanTitle : null,
      accessibility:
        cleanAccTitle.length > 0 || cleanAccDescr.length > 0
          ? {
              accTitle: cleanAccTitle.length > 0 ? cleanAccTitle : undefined,
              accDescr: cleanAccDescr.length > 0 ? cleanAccDescr : undefined,
            }
          : null,
    });
    onClose();
  };

  const handleClear = () => {
    onApply({
      title: null,
      accessibility: null,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const hasAnyData = Boolean(
    (initialTitle && initialTitle.trim()) ||
      (initialAccessibility?.accTitle && initialAccessibility.accTitle.trim()) ||
      (initialAccessibility?.accDescr && initialAccessibility.accDescr.trim())
  );

  return (
    <div
      ref={popoverRef}
      className="mermaid-popover-menu mermaid-info-popover nodrag"
      style={
        popoverPos
          ? {
              position: 'absolute',
              left: popoverPos.left,
              top: popoverPos.top,
              transform: popoverPos.transform,
              zIndex: 200,
            }
          : {
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              zIndex: 200,
            }
      }
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Diagram Info and Accessibility"
    >
      <div className="mermaid-popover-header">
        <span className="mermaid-popover-title">
          <InfoIcon size={14} />
          <span>Diagram Info & Accessibility</span>
        </span>
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

      <form onSubmit={handleSave} className="mermaid-info-form">
        <div className="mermaid-info-field">
          <label className="mermaid-info-label">Diagram Title</label>
          <input
            ref={titleInputRef}
            type="text"
            className="mermaid-info-input"
            placeholder="e.g. System Architecture 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="mermaid-info-field">
          <label className="mermaid-info-label">
            Accessible Title <span className="mermaid-info-badge">accTitle</span>
          </label>
          <input
            type="text"
            className="mermaid-info-input"
            placeholder="Screen-reader title (SVG <title>)"
            value={accTitle}
            onChange={(e) => setAccTitle(e.target.value)}
          />
        </div>

        <div className="mermaid-info-field">
          <label className="mermaid-info-label">
            Accessible Description <span className="mermaid-info-badge">accDescr</span>
          </label>
          <textarea
            rows={3}
            className="mermaid-info-textarea"
            placeholder="Detailed description for assistive technologies (SVG <desc>)..."
            value={accDescr}
            onChange={(e) => setAccDescr(e.target.value)}
          />
        </div>

        <div className="mermaid-info-actions">
          {hasAnyData && (
            <button
              type="button"
              className="mermaid-btn-danger-outline"
              onClick={handleClear}
              title="Clear title and accessibility metadata"
            >
              <TrashIcon size={12} />
              <span>Clear</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button type="submit" className="mermaid-btn-primary">
            <CheckIcon size={13} />
            <span>Save</span>
          </button>
        </div>
      </form>
    </div>
  );
};

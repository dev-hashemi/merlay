/**
 * In-Canvas Diagram Title Header
 *
 * Renders an understated, inline-editable diagram title at the top of the canvas,
 * mapped directly to the diagram's YAML frontmatter `title` field.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiagramAccessibility } from '../../diagrams/common';
import { PencilIcon, CheckIcon, CloseIcon, InfoIcon } from '../icons/Icons';
import { DiagramInfoPopover } from './DiagramInfoPopover';

export interface CanvasTitleHeaderProps {
  title?: string;
  isEditable?: boolean;
  accessibility?: DiagramAccessibility;
  supportsAccessibility?: boolean;
  onUpdateTitle: (title: string | null) => void;
  onUpdateAccessibility?: (acc: DiagramAccessibility | null) => void;
}

export const CanvasTitleHeader: React.FC<CanvasTitleHeaderProps> = ({
  title,
  isEditable = true,
  accessibility,
  supportsAccessibility = false,
  onUpdateTitle,
  onUpdateAccessibility,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [draftTitle, setDraftTitle] = useState<string>(title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(title || '');
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleCommit = () => {
    setIsEditing(false);
    const clean = draftTitle.trim();
    if (clean === (title || '').trim()) return;
    onUpdateTitle(clean.length > 0 ? clean : null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftTitle(title || '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="mermaid-canvas-title-wrapper nodrag" onClick={(e) => e.stopPropagation()}>
        <div className="mermaid-canvas-title-edit-box">
          <input
            ref={inputRef}
            type="text"
            className="mermaid-canvas-title-input"
            value={draftTitle}
            placeholder="Diagram Title..."
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleCommit}
          />
          <button
            type="button"
            className="mermaid-tool-btn icon-only"
            onClick={handleCommit}
            title="Save title (Enter)"
            onMouseDown={(e) => e.preventDefault()}
          >
            <CheckIcon size={13} />
          </button>
          <button
            type="button"
            className="mermaid-tool-btn icon-only"
            onClick={handleCancel}
            title="Cancel (Esc)"
            onMouseDown={(e) => e.preventDefault()}
          >
            <CloseIcon size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-canvas-title-wrapper nodrag" onClick={(e) => e.stopPropagation()}>
      {!title ? (
        isEditable && (
          <button
            type="button"
            className="mermaid-canvas-add-title-btn"
            onClick={() => setIsEditing(true)}
            title="Add Diagram Title"
          >
            <span>+ Add Title</span>
          </button>
        )
      ) : (
        <div
          className={`mermaid-canvas-title-badge ${isEditable ? 'is-clickable' : ''}`}
          onClick={() => {
            if (isEditable) setIsEditing(true);
          }}
          title={isEditable ? 'Click to edit diagram title' : undefined}
        >
          <span className="mermaid-canvas-title-text">{title}</span>
          {isEditable && (
            <span className="mermaid-canvas-title-edit-hint">
              <PencilIcon size={11} />
            </span>
          )}
        </div>
      )}

      {/* Info / A11y Button */}
      {supportsAccessibility && (
        <button
          type="button"
          className={`mermaid-canvas-info-btn ${isInfoOpen ? 'is-active' : ''} ${
            accessibility?.accTitle || accessibility?.accDescr ? 'has-a11y' : ''
          }`}
          onClick={() => setIsInfoOpen(!isInfoOpen)}
          title={
            accessibility?.accTitle || accessibility?.accDescr
              ? `Diagram Info & Accessibility: ${accessibility.accTitle || 'Description set'}`
              : 'Diagram Info & Accessibility (accTitle, accDescr)'
          }
          aria-label="Diagram Info & Accessibility"
        >
          <InfoIcon size={12} />
        </button>
      )}

      {/* Info Popover */}
      {isInfoOpen && (
        <DiagramInfoPopover
          popoverPos={{
            left: 0,
            top: 32,
            transform: 'none',
          }}
          initialTitle={title}
          initialAccessibility={accessibility}
          onApply={({ title: newTitle, accessibility: newAcc }) => {
            onUpdateTitle(newTitle);
            onUpdateAccessibility?.(newAcc);
          }}
          onClose={() => setIsInfoOpen(false)}
        />
      )}
    </div>
  );
};

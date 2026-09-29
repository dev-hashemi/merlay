/**
 * In-Canvas Diagram Title Header
 *
 * Renders an understated, inline-editable diagram title at the top of the canvas,
 * mapped directly to the diagram's YAML frontmatter `title` field.
 */

import React, { useEffect, useRef, useState } from 'react';
import { PencilIcon, CheckIcon, CloseIcon } from '../icons/Icons';

export interface CanvasTitleHeaderProps {
  title?: string;
  isEditable?: boolean;
  onUpdateTitle: (title: string | null) => void;
}

export const CanvasTitleHeader: React.FC<CanvasTitleHeaderProps> = ({
  title,
  isEditable = true,
  onUpdateTitle,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
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

  // Not editing: render title badge or subtle add placeholder
  if (!title) {
    if (!isEditable) return null;
    return (
      <div className="mermaid-canvas-title-wrapper nodrag">
        <button
          type="button"
          className="mermaid-canvas-add-title-btn"
          onClick={() => setIsEditing(true)}
          title="Add Diagram Title"
        >
          <span>+ Add Title</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mermaid-canvas-title-wrapper nodrag">
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
    </div>
  );
};

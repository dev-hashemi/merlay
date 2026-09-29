/**
 * Note Popover: Add, edit, position, and remove notes on diagram elements.
 * Supports sequence notes (left, over, right), state notes (left, right), and class notes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiagramNoteDetails, NotePosition } from '../../diagrams/common';
import { PopoverPos } from '../types';
import { StickyNoteIcon, TrashIcon, CheckIcon, CloseIcon } from '../icons/Icons';

export interface NotePopoverProps {
  popoverPos: PopoverPos | null;
  initialNote?: DiagramNoteDetails;
  notePositions?: readonly NotePosition[];
  targetLabel?: string;
  onApply: (note: DiagramNoteDetails) => void;
  onRemove: () => void;
  onClose: () => void;
}

export const NotePopover: React.FC<NotePopoverProps> = ({
  popoverPos,
  initialNote,
  notePositions,
  targetLabel,
  onApply,
  onRemove,
  onClose,
}) => {
  const [text, setText] = useState<string>(initialNote?.text || '');
  const [position, setPosition] = useState<NotePosition>(
    initialNote?.position || notePositions?.[0] || 'right'
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(initialNote?.text || '');
    setPosition(initialNote?.position || notePositions?.[0] || 'right');
    // Auto-focus textarea on open (cross-window safe for Obsidian popouts)
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 50);
  }, [initialNote, notePositions]);

  if (!popoverPos) return null;

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = text.trim();
    if (!clean) {
      onRemove();
      onClose();
      return;
    }
    onApply({
      text: clean,
      position: notePositions && notePositions.length > 0 ? position : undefined,
      secondTargetId: initialNote?.secondTargetId,
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

  return (
    <div
      className="mermaid-popover-menu mermaid-note-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <div className="mermaid-popover-header">
        <span className="mermaid-popover-title">
          <StickyNoteIcon size={13} />
          <span>{initialNote?.text ? 'Edit Note' : 'Add Note'}{targetLabel ? ` (${targetLabel})` : ''}</span>
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

      <form onSubmit={handleSave} className="mermaid-note-form">
        {/* Placement Selector (when multiple positions are available) */}
        {notePositions && notePositions.length > 1 && (
          <div className="mermaid-note-pos-row">
            <span className="mermaid-note-pos-label">Position:</span>
            <div className="mermaid-note-pos-segmented">
              {notePositions.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  className={`mermaid-note-pos-btn ${position === pos ? 'is-active' : ''}`}
                  onClick={() => setPosition(pos)}
                >
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mermaid-note-field">
          <textarea
            ref={textareaRef}
            rows={3}
            className="mermaid-note-textarea"
            placeholder="Write a note... (Ctrl+Enter to save)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="mermaid-note-actions">
          {initialNote?.text && (
            <button
              type="button"
              className="mermaid-btn-danger-outline"
              onClick={() => {
                onRemove();
                onClose();
              }}
              title="Delete note"
            >
              <TrashIcon size={12} />
              <span>Delete</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            type="submit"
            className="mermaid-btn-primary"
            disabled={!text.trim()}
          >
            <CheckIcon size={13} />
            <span>Save</span>
          </button>
        </div>
      </form>
    </div>
  );
};

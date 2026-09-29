/**
 * Shape Data Popover: edits one `@{ ... }` param of a special node shape
 * (image URL, icon name). Single-field form reusing the link popover styles.
 */

import React, { useEffect, useRef, useState } from 'react';
import { PopoverPos } from '../types';
import { ImageIcon, TrashIcon, CheckIcon, CloseIcon } from '../icons/Icons';

export interface ShapeDataPopoverProps {
  popoverPos: PopoverPos | null;
  /** e.g. "Image URL" / "Icon name". */
  fieldLabel: string;
  /** e.g. "https://..." / "fa:user". */
  placeholder: string;
  initialValue: string;
  /** Autocomplete suggestions (e.g. common icon names). Absent = plain input. */
  suggestions?: string[];
  /** One-line usage hint rendered under the input. */
  hint?: string;
  onApply: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export const ShapeDataPopover: React.FC<ShapeDataPopoverProps> = ({
  popoverPos,
  fieldLabel,
  placeholder,
  initialValue,
  suggestions,
  hint,
  onApply,
  onClear,
  onClose,
}) => {
  const [value, setValue] = useState<string>(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [initialValue]);

  if (!popoverPos) return null;

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = value.trim();
    if (!clean) {
      onClear();
      onClose();
      return;
    }
    onApply(clean);
    onClose();
  };

  return (
    <div
      className="mermaid-popover-menu mermaid-link-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSave();
        }
      }}
    >
      <div className="mermaid-popover-header">
        <span className="mermaid-popover-title">
          <ImageIcon size={13} />
          <span>{initialValue ? `Edit ${fieldLabel}` : `Set ${fieldLabel}`}</span>
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

      <form onSubmit={handleSave} className="mermaid-link-form">
        <div className="mermaid-link-field">
          <label htmlFor="mermaid-shapedata-input" className="mermaid-link-label">
            {fieldLabel}
          </label>
          <input
            id="mermaid-shapedata-input"
            ref={inputRef}
            type="text"
            className="mermaid-link-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list={suggestions ? 'mermaid-shapedata-suggestions' : undefined}
            autoComplete={suggestions ? 'off' : undefined}
          />
          {suggestions && (
            <datalist id="mermaid-shapedata-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          {hint && <div className="mermaid-link-hint">{hint}</div>}
        </div>

        <div className="mermaid-link-actions">
          {initialValue && (
            <button
              type="button"
              className="mermaid-btn-danger-outline"
              onClick={() => {
                onClear();
                onClose();
              }}
              title="Clear value"
            >
              <TrashIcon size={12} />
              <span>Clear</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            type="submit"
            className="mermaid-btn-primary"
            disabled={!value.trim()}
          >
            <CheckIcon size={13} />
            <span>Apply</span>
          </button>
        </div>
      </form>
    </div>
  );
};

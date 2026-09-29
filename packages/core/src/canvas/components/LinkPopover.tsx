/**
 * Link Popover: Add, edit, test, and remove hyperlinks on diagram nodes.
 * Supports web URLs (https://...) and internal note links ([[Note]]).
 */

import React, { useEffect, useRef, useState } from 'react';
import { NodeLinkDetails } from '../../diagrams/nodeLinks';
import { PopoverPos } from '../types';
import { LinkIcon, TrashIcon, CheckIcon, CloseIcon } from '../icons/Icons';

export interface LinkPopoverProps {
  popoverPos: PopoverPos | null;
  initialDetails?: NodeLinkDetails;
  onApply: (details: NodeLinkDetails) => void;
  onRemove: () => void;
  onClose: () => void;
  onOpenLink?: (url: string) => void;
}

export const LinkPopover: React.FC<LinkPopoverProps> = ({
  popoverPos,
  initialDetails,
  onApply,
  onRemove,
  onClose,
  onOpenLink,
}) => {
  const [url, setUrl] = useState<string>(initialDetails?.url || '');
  const [tooltip, setTooltip] = useState<string>(initialDetails?.tooltip || '');
  const [openInNewTab, setOpenInNewTab] = useState<boolean>(
    initialDetails?.target === '_blank' || !initialDetails?.target
  );

  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(initialDetails?.url || '');
    setTooltip(initialDetails?.tooltip || '');
    setOpenInNewTab(initialDetails?.target === '_blank' || !initialDetails?.target);
    // Auto-focus url field when opened
    window.setTimeout(() => urlInputRef.current?.focus(), 50);
  }, [initialDetails]);

  if (!popoverPos) return null;

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      onRemove();
      onClose();
      return;
    }
    onApply({
      url: cleanUrl,
      tooltip: tooltip.trim() || undefined,
      target: openInNewTab ? '_blank' : undefined,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
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
      onKeyDown={handleKeyDown}
    >
      <div className="mermaid-popover-header">
        <span className="mermaid-popover-title">
          <LinkIcon size={13} />
          <span>{initialDetails?.url ? 'Edit Link' : 'Add Link'}</span>
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
          <label htmlFor="mermaid-link-url" className="mermaid-link-label">
            Target URL or Note
          </label>
          <input
            id="mermaid-link-url"
            ref={urlInputRef}
            type="text"
            className="mermaid-link-input"
            placeholder="https://... or [[Note Name]]"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="mermaid-link-field">
          <label htmlFor="mermaid-link-tooltip" className="mermaid-link-label">
            Tooltip (Optional)
          </label>
          <input
            id="mermaid-link-tooltip"
            type="text"
            className="mermaid-link-input"
            placeholder="Hover description..."
            value={tooltip}
            onChange={(e) => setTooltip(e.target.value)}
          />
        </div>

        <div className="mermaid-link-checkbox-row">
          <label className="mermaid-link-checkbox-label">
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
            />
            <span>Open in new tab (_blank)</span>
          </label>
        </div>

        <div className="mermaid-link-actions">
          {initialDetails?.url && (
            <button
              type="button"
              className="mermaid-btn-danger-outline"
              onClick={() => {
                onRemove();
                onClose();
              }}
              title="Remove link"
            >
              <TrashIcon size={12} />
              <span>Remove</span>
            </button>
          )}

          {initialDetails?.url && onOpenLink && (
            <button
              type="button"
              className="mermaid-tool-btn"
              onClick={() => onOpenLink(initialDetails.url)}
              title="Test / Open Link"
            >
              <span>Test Link</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            type="submit"
            className="mermaid-btn-primary"
            disabled={!url.trim()}
          >
            <CheckIcon size={13} />
            <span>Apply</span>
          </button>
        </div>
      </form>
    </div>
  );
};

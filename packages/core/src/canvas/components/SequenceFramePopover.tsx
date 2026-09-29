import React, { useState } from 'react';
import { PopoverPos } from '../types';
import { SequenceFrameType } from '../../diagrams/sequence/mutations/frameMutations';
import { CloseIcon } from '../icons/Icons';

export interface SequenceFramePopoverProps {
  popoverPos: PopoverPos | null;
  onApply: (type: SequenceFrameType, label?: string) => void;
  onClose: () => void;
}

const FRAME_OPTIONS: Array<{ type: SequenceFrameType; label: string; placeholder: string }> = [
  { type: 'loop', label: 'Loop', placeholder: 'e.g. Every 5s / Retry 3 times' },
  { type: 'alt', label: 'Alt', placeholder: 'e.g. Status == 200 OK' },
  { type: 'opt', label: 'Opt', placeholder: 'e.g. If authenticated' },
  { type: 'par', label: 'Par', placeholder: 'e.g. Fetch user profile' },
  { type: 'critical', label: 'Critical', placeholder: 'e.g. Database transaction' },
  { type: 'break', label: 'Break', placeholder: 'e.g. Network error' },
  { type: 'rect', label: 'Rect', placeholder: 'e.g. rgb(224, 242, 254)' },
];

const RECT_PRESETS = [
  { label: 'Sky', value: 'rgb(224, 242, 254)' },
  { label: 'Mint', value: 'rgb(220, 252, 231)' },
  { label: 'Lemon', value: 'rgb(254, 249, 195)' },
  { label: 'Rose', value: 'rgb(254, 226, 226)' },
  { label: 'Lavender', value: 'rgb(243, 232, 255)' },
];

export const SequenceFramePopover: React.FC<SequenceFramePopoverProps> = ({
  popoverPos,
  onApply,
  onClose,
}) => {
  const [frameType, setFrameType] = useState<SequenceFrameType>('loop');
  const [label, setLabel] = useState('');

  if (!popoverPos) return null;

  const currentOption = FRAME_OPTIONS.find((o) => o.type === frameType) || FRAME_OPTIONS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(frameType, label.trim() || undefined);
    onClose();
  };

  return (
    <div
      className="mermaid-popover-menu mermaid-frame-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mermaid-frame-header">
        <span className="mermaid-frame-title">Wrap in Frame</span>
        <button
          type="button"
          className="mermaid-frame-close-btn"
          onClick={onClose}
          aria-label="Close frame popover"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <div className="mermaid-frame-tabs">
        {FRAME_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            className={`mermaid-frame-tab-btn ${frameType === opt.type ? 'is-active' : ''}`}
            onClick={() => {
              setFrameType(opt.type);
              if (opt.type === 'rect' && !label) {
                setLabel(RECT_PRESETS[0].value);
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mermaid-frame-body">
        {frameType === 'rect' && (
          <div className="mermaid-frame-swatches">
            {RECT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`mermaid-frame-color-circle ${label === preset.value ? 'is-active' : ''}`}
                style={{ backgroundColor: preset.value }}
                title={preset.label}
                onClick={() => setLabel(preset.value)}
              />
            ))}
          </div>
        )}

        <div className="mermaid-frame-input-row">
          <input
            type="text"
            className="mermaid-frame-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={currentOption.placeholder}
            autoFocus
          />
        </div>

        <div className="mermaid-frame-actions">
          <button type="submit" className="mermaid-frame-apply-btn">
            Apply Frame
          </button>
        </div>
      </form>
    </div>
  );
};

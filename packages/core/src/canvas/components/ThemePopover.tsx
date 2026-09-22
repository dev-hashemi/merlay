import React, { useEffect, useRef } from 'react';
import { CloseIcon } from '../icons/Icons';
import { MermaidTheme } from '../../diagrams/common';

export interface ThemeOption {
  id: MermaidTheme | 'auto';
  value: MermaidTheme | null;
  label: string;
  description: string;
  color: string;
  borderColor: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'auto',
    value: null,
    label: 'Auto (System)',
    description: 'Adapts to Obsidian light / dark mode',
    color: 'var(--mermaid-accent)',
    borderColor: 'var(--mermaid-border)',
  },
  {
    id: 'default',
    value: 'default',
    label: 'Default',
    description: 'Mermaid classic purple & blue tones',
    color: '#ECECFF',
    borderColor: '#9370DB',
  },
  {
    id: 'neutral',
    value: 'neutral',
    label: 'Neutral',
    description: 'Clean grayscale black & white styling',
    color: '#f4f4f4',
    borderColor: '#555555',
  },
  {
    id: 'forest',
    value: 'forest',
    label: 'Forest',
    description: 'Earthy greens and natural palette',
    color: '#e1f5fe',
    borderColor: '#2e7d32',
  },
  {
    id: 'dark',
    value: 'dark',
    label: 'Dark',
    description: 'High-contrast dark mode styling',
    color: '#1e293b',
    borderColor: '#38bdf8',
  },
  {
    id: 'base',
    value: 'base',
    label: 'Base',
    description: 'Minimal unstyled foundation',
    color: '#ffffff',
    borderColor: '#94a3b8',
  },
];

export interface ThemePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: string;
  onSelectTheme: (theme: MermaidTheme | null) => void;
}

export const ThemePopover: React.FC<ThemePopoverProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={popoverRef}
      className="mermaid-popover-menu mermaid-theme-popover nodrag"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Diagram Theme Menu"
    >
      <div className="mermaid-popover-header">
        <span>Diagram Theme</span>
        <button
          type="button"
          className="mermaid-popover-close-btn"
          onClick={onClose}
          title="Close theme menu"
          aria-label="Close theme menu"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <div className="mermaid-theme-list">
        {THEME_OPTIONS.map((opt) => {
          const isSelected =
            (opt.id === 'auto' && !currentTheme) ||
            currentTheme === opt.id ||
            currentTheme === opt.value;
          return (
            <button
              key={opt.id}
              type="button"
              className={`mermaid-theme-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => {
                onSelectTheme(opt.value);
                onClose();
              }}
              title={opt.description}
            >
              <span
                className="mermaid-theme-swatch"
                style={{
                  backgroundColor: opt.color,
                  borderColor: opt.borderColor,
                }}
              />
              <div className="mermaid-theme-info">
                <span className="mermaid-theme-label">{opt.label}</span>
                <span className="mermaid-theme-desc">{opt.description}</span>
              </div>
              {isSelected && <span className="mermaid-check-mark">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { PopoverPos } from '../types';
import { THEME_PRESETS, ThemePreset } from '../constants';
import {
  SwatchesGrid,
  StrokeWidthControl,
  StrokeDashControl,
  ColorPickerRow,
  ResetStyleButton,
} from './StyleControls';

export interface NodeStylePopoverProps {
  popoverPos: PopoverPos | null;
  currentStyle: Record<string, string> | undefined;
  onApplyPreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (property: string, value: string) => void;
  onClearStyle: () => void;
  defaultDash?: 'solid' | 'dashed';
  onSetDefaultStyle?: (style?: Record<string, string>) => void;
  onClearDefaultStyle?: () => void;
  hasDefaultStyle?: boolean;
}

export const NodeStylePopover: React.FC<NodeStylePopoverProps> = ({
  popoverPos,
  currentStyle,
  onApplyPreset,
  onUpdateCustomStyle,
  onClearStyle,
  defaultDash = 'solid',
  onSetDefaultStyle,
  onClearDefaultStyle,
  hasDefaultStyle = false,
}) => {
  if (!popoverPos) return null;

  const solidValue = defaultDash === 'dashed' ? 'none' : '';
  const effectiveDash = currentStyle?.['stroke-dasharray'] ?? (defaultDash === 'dashed' ? '5 5' : '');

  return (
    <div
      className="mermaid-popover-menu mermaid-style-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <SwatchesGrid
        title="Themes"
        presets={THEME_PRESETS}
        activeValue={currentStyle?.fill}
        valueKey="fill"
        onApply={onApplyPreset}
      />

      <StrokeWidthControl
        title="Border"
        currentWidth={currentStyle?.['stroke-width']}
        onUpdate={(w) => onUpdateCustomStyle('stroke-width', w)}
      />

      <StrokeDashControl
        currentDash={effectiveDash}
        solidValue={solidValue}
        onUpdate={(d) => onUpdateCustomStyle('stroke-dasharray', d)}
      />

      <ColorPickerRow
        label="Fill Color"
        value={currentStyle?.fill || '#ffffff'}
        title="Custom Fill Color"
        onChange={(v) => onUpdateCustomStyle('fill', v)}
      />

      <ColorPickerRow
        label="Border Color"
        value={currentStyle?.stroke || '#7c3aed'}
        title="Custom Border Color"
        onChange={(v) => onUpdateCustomStyle('stroke', v)}
      />

      <ColorPickerRow
        label="Text Color"
        value={currentStyle?.color || '#000000'}
        title="Custom Text Color"
        onChange={(v) => onUpdateCustomStyle('color', v)}
      />

      <div className="mermaid-style-footer-actions">
        {onSetDefaultStyle && (
          <button
            type="button"
            className="mermaid-style-default-action-btn"
            onClick={() => onSetDefaultStyle(currentStyle)}
            title="Make this style the default theme for all current and future steps"
          >
            Set as Diagram Default
          </button>
        )}

        <div className="mermaid-style-reset-row">
          <ResetStyleButton label="Reset to Default Theme" onReset={() => onClearStyle()} />
          {hasDefaultStyle && onClearDefaultStyle && (
            <button
              type="button"
              className="mermaid-style-reset-btn"
              onClick={() => onClearDefaultStyle()}
              title="Remove diagram default theme and revert to clean unstyled Mermaid"
            >
              Clear Diagram Default
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable UI controls for styling popovers (Swatches, Stroke Width, Dash style, Color Pickers, Reset).
 */

import React from 'react';
import { CheckIcon } from '../icons/Icons';

export interface BaseThemePreset {
  name: string;
  bgPreview: string;
  borderPreview: string;
  fill?: string;
  stroke?: string;
}

export interface SwatchesGridProps<T extends BaseThemePreset> {
  title?: string;
  presets: T[];
  activeValue?: string;
  valueKey?: 'fill' | 'stroke';
  onApply: (preset: T) => void;
}

export function SwatchesGrid<T extends BaseThemePreset>({
  title = 'Themes',
  presets,
  activeValue,
  valueKey = 'fill',
  onApply,
}: SwatchesGridProps<T>) {
  return (
    <>
      <div className="mermaid-style-popover-title">{title}</div>
      <div className="mermaid-swatches-grid">
        {presets.map((p) => {
          const targetProp = p[valueKey];
          const isCurrent =
            (!targetProp && !activeValue) ||
            (Boolean(activeValue) && activeValue?.toLowerCase() === targetProp?.toLowerCase());

          return (
            <button
              key={p.name}
              type="button"
              className={`mermaid-swatch-btn ${isCurrent ? 'is-active' : ''}`}
              style={{
                backgroundColor: p.bgPreview,
                borderColor: p.borderPreview,
              }}
              onClick={() => onApply(p)}
              title={p.name}
            >
              {isCurrent && <CheckIcon size={12} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

export interface StrokeWidthControlProps {
  title?: string;
  currentWidth?: string;
  onUpdate: (width: string) => void;
}

export const StrokeWidthControl: React.FC<StrokeWidthControlProps> = ({
  title = 'Border',
  currentWidth,
  onUpdate,
}) => (
  <div className="mermaid-style-control-row">
    <span className="mermaid-style-popover-title">{title}</span>
    <div className="mermaid-style-segmented">
      {['1px', '2px', '3px', '4px'].map((w) => {
        const isCurrent = currentWidth === w;
        return (
          <button
            key={w}
            type="button"
            className={`mermaid-segmented-btn ${isCurrent ? 'is-active' : ''}`}
            onClick={() => onUpdate(w)}
          >
            {w}
          </button>
        );
      })}
    </div>
  </div>
);

export interface StrokeDashControlProps {
  currentDash?: string;
  solidValue?: string;
  onUpdate: (dash: string) => void;
}

export const StrokeDashControl: React.FC<StrokeDashControlProps> = ({
  currentDash,
  solidValue = '',
  onUpdate,
}) => (
  <div className="mermaid-style-control-row">
    <span className="mermaid-style-popover-title">Dash</span>
    <div className="mermaid-style-segmented">
      {[
        { label: 'Solid', value: solidValue },
        { label: 'Dashed', value: '5 5' },
        { label: 'Dotted', value: '2 2' },
      ].map((dash) => {
        const isCurrent =
          (!dash.value && !currentDash) ||
          currentDash === dash.value ||
          (dash.label === 'Solid' && currentDash === solidValue);
        return (
          <button
            key={dash.label}
            type="button"
            className={`mermaid-segmented-btn ${isCurrent ? 'is-active' : ''}`}
            onClick={() => onUpdate(dash.value)}
          >
            {dash.label}
          </button>
        );
      })}
    </div>
  </div>
);

export interface ColorPickerRowProps {
  label: string;
  value: string;
  title?: string;
  onChange: (color: string) => void;
}

export const ColorPickerRow: React.FC<ColorPickerRowProps> = ({
  label,
  value,
  title,
  onChange,
}) => (
  <div className="mermaid-style-control-row">
    <span>{label}</span>
    <div className="mermaid-color-input-wrapper">
      <input
        type="color"
        className="mermaid-color-picker-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={title || label}
      />
    </div>
  </div>
);

export interface ResetStyleButtonProps {
  label: string;
  onReset: () => void;
}

export const ResetStyleButton: React.FC<ResetStyleButtonProps> = ({
  label,
  onReset,
}) => (
  <button type="button" className="mermaid-style-reset-btn" onClick={() => onReset()}>
    {label}
  </button>
);

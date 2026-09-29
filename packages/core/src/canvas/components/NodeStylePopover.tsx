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
  classDefs?: Array<{ name: string; styles: Record<string, string> }>;
  nodeClasses?: string[];
  onToggleNodeClass?: (className: string) => void;
  onSaveClassDef?: (name: string, styles: Record<string, string>) => void;
  onDeleteClassDef?: (name: string) => void;
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
  classDefs,
  nodeClasses,
  onToggleNodeClass,
  onSaveClassDef,
  onDeleteClassDef,
}) => {
  const [isSavingClass, setIsSavingClass] = React.useState(false);
  const [newClassName, setNewClassName] = React.useState('');

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

      {/* Reusable ClassDef Styles (Flowchart, Class diagrams) */}
      {(classDefs !== undefined || onSaveClassDef) && (
        <div className="mermaid-style-section mermaid-classdef-section">
          <div className="mermaid-style-section-title">
            <span>Class Styles (classDef)</span>
            {!isSavingClass && onSaveClassDef && (
              <button
                type="button"
                className="mermaid-classdef-add-trigger"
                onClick={() => setIsSavingClass(true)}
                title="Save current styling as a reusable class"
              >
                + New Class
              </button>
            )}
          </div>

          {classDefs && classDefs.length > 0 && (
            <div className="mermaid-classdef-chips">
              {classDefs.map((cd) => {
                const isActive = nodeClasses?.includes(cd.name);
                const dotColor = cd.styles.fill || cd.styles.stroke || 'var(--mermaid-accent)';
                return (
                  <div
                    key={cd.name}
                    className={`mermaid-classdef-chip ${isActive ? 'is-active' : ''}`}
                    onClick={() => onToggleNodeClass?.(cd.name)}
                    title={`Click to ${isActive ? 'remove' : 'apply'} class ${cd.name}`}
                  >
                    <span
                      className="mermaid-classdef-dot"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="mermaid-classdef-name">{cd.name}</span>
                    {onDeleteClassDef && (
                      <button
                        type="button"
                        className="mermaid-classdef-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClassDef(cd.name);
                        }}
                        title={`Delete classDef ${cd.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isSavingClass && (
            <form
              className="mermaid-classdef-save-form"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newClassName.trim();
                if (trimmed && onSaveClassDef) {
                  onSaveClassDef(trimmed, currentStyle || {});
                  setNewClassName('');
                  setIsSavingClass(false);
                }
              }}
            >
              <input
                type="text"
                className="mermaid-classdef-input"
                placeholder="Class name (e.g. highlight)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="mermaid-classdef-save-btn">
                Save
              </button>
              <button
                type="button"
                className="mermaid-classdef-cancel-btn"
                onClick={() => {
                  setIsSavingClass(false);
                  setNewClassName('');
                }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

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

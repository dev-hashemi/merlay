/**
 * Overlays for Selected Edges: Edge Action HUD and Edge Style Popover.
 */

import React from 'react';
import { ActiveEdgePopover, SelectedEdgePos } from '../types';
import { EdgeThemePreset } from '../constants';
import { DiagramDriver } from '../../diagrams/types';
import { EdgeActionHud } from '../components/EdgeActionHud';
import { EdgeStylePopover } from '../components/EdgeStylePopover';

export interface EdgeOverlaysProps {
  selectedEdgePos: SelectedEdgePos | null;
  selectedEdgeId: string | null;
  isMultiSelect: boolean;
  driver: DiagramDriver;
  selectedEdgeStyle: Record<string, string> | undefined;
  activeEdgePopover: ActiveEdgePopover;
  onChangeEdgeType: (newType: string) => void;
  onReverseEdge: () => void;
  onInsertNodeOnEdge: (edgeId: string) => void;
  onUpdateEdgeLabel: (newLabel: string) => void;
  onToggleEdgeStyle: () => void;
  onDeleteEdge: () => void;
  onApplyEdgePreset: (preset: EdgeThemePreset) => void;
  onUpdateEdgeCustomStyle: (prop: string, val: string) => void;
  onClearEdgeStyle: () => void;
  onSetDefaultStyle?: () => void;
  onClearDefaultStyle?: () => void;
  hasDefaultStyle?: boolean;
}

export const EdgeOverlays: React.FC<EdgeOverlaysProps> = ({
  selectedEdgePos,
  selectedEdgeId,
  isMultiSelect,
  driver,
  selectedEdgeStyle,
  activeEdgePopover,
  onChangeEdgeType,
  onReverseEdge,
  onInsertNodeOnEdge,
  onUpdateEdgeLabel,
  onToggleEdgeStyle,
  onDeleteEdge,
  onApplyEdgePreset,
  onUpdateEdgeCustomStyle,
  onClearEdgeStyle,
  onSetDefaultStyle,
  onClearDefaultStyle,
  hasDefaultStyle,
}) => {
  return (
    <>
      {/* Selected Edge HUD */}
      {selectedEdgePos && selectedEdgeId && !isMultiSelect && (
        <EdgeActionHud
          selectedEdgeId={selectedEdgeId}
          selectedEdgePos={selectedEdgePos}
          driver={driver}
          selectedEdgeStyle={selectedEdgeStyle}
          activeEdgePopover={activeEdgePopover}
          onChangeEdgeType={onChangeEdgeType}
          onReverseEdge={onReverseEdge}
          onInsertNodeOnEdge={() => onInsertNodeOnEdge(selectedEdgeId)}
          onUpdateEdgeLabel={onUpdateEdgeLabel}
          onToggleStylePopover={onToggleEdgeStyle}
          onDeleteEdge={onDeleteEdge}
        />
      )}

      {/* Edge Style Popover (only when the diagram supports edge styling) */}
      {activeEdgePopover === 'style' &&
        driver.capabilities.supportsEdgeStyles &&
        selectedEdgePos &&
        selectedEdgeId &&
        !isMultiSelect && (
          <EdgeStylePopover
            selectedEdgePos={selectedEdgePos}
            currentEdgeStyle={selectedEdgeStyle}
            onApplyPreset={onApplyEdgePreset}
            onUpdateCustomStyle={onUpdateEdgeCustomStyle}
            onClearStyle={onClearEdgeStyle}
            onSetDefaultStyle={onSetDefaultStyle}
            onClearDefaultStyle={onClearDefaultStyle}
            hasDefaultStyle={hasDefaultStyle}
          />
        )}
    </>
  );
};

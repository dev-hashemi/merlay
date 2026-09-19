/**
 * Overlays for Multi-Selection: MultiSelect HUD, batch edge type popover, batch kind popover, batch style popover.
 */

import React from 'react';
import { ActiveMultiPopover, PopoverPos } from '../types';
import { ThemePreset } from '../constants';
import { MermaidNodeDef } from '../../diagrams/viewModel';
import { DiagramDriver } from '../../diagrams/types';
import { MultiSelectHud } from '../components/MultiSelectHud';
import { EdgeTypePopover } from '../components/EdgeTypePopover';
import { KindPopover } from '../components/KindPopover';
import { NodeStylePopover } from '../components/NodeStylePopover';

export interface MultiSelectOverlaysProps {
  multiSelectBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    topY: number;
  } | null;
  isMultiSelect: boolean;
  driver: DiagramDriver;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  activeMultiPopover: ActiveMultiPopover;
  onToggleMultiPopover: (popover: 'shape' | 'style' | 'edgeType') => void;
  onBatchDelete: () => void;
  onBatchGroup: () => void;
  canUngroup: boolean;
  onBatchUngroup: () => void;

  popoverPos: PopoverPos | null;
  onBatchUpdateEdgeType: (newType: string) => void;
  viewNodes: Map<string, MermaidNodeDef>;
  onBatchSelectNodeKind: (kind: string) => void;
  onApplyPreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (prop: string, val: string) => void;
  onClearStyle: () => void;
  onSetDefaultStyle?: () => void;
  onClearDefaultStyle?: () => void;
  hasDefaultStyle?: boolean;
}

export const MultiSelectOverlays: React.FC<MultiSelectOverlaysProps> = ({
  multiSelectBounds,
  isMultiSelect,
  driver,
  selectedNodeIds,
  selectedEdgeIds,
  activeMultiPopover,
  onToggleMultiPopover,
  onBatchDelete,
  onBatchGroup,
  canUngroup,
  onBatchUngroup,
  popoverPos,
  onBatchUpdateEdgeType,
  viewNodes,
  onBatchSelectNodeKind,
  onApplyPreset,
  onUpdateCustomStyle,
  onClearStyle,
  onSetDefaultStyle,
  onClearDefaultStyle,
  hasDefaultStyle,
}) => {
  if (!isMultiSelect) return null;

  return (
    <>
      {/* Multi-Select Floating Action HUD */}
      {multiSelectBounds && (
        <MultiSelectHud
          driver={driver}
          selectedNodeCount={selectedNodeIds.size}
          selectedEdgeCount={selectedEdgeIds.size}
          centerX={multiSelectBounds.centerX}
          topY={multiSelectBounds.topY}
          activePopover={activeMultiPopover}
          onTogglePopover={onToggleMultiPopover}
          onBatchDelete={onBatchDelete}
          onGroupSelected={onBatchGroup}
          canUngroup={canUngroup}
          onUngroupSelected={onBatchUngroup}
        />
      )}

      {/* Multi-Select Edge Type Popover */}
      {activeMultiPopover === 'edgeType' &&
        driver.capabilities.supportsEdgeTypes &&
        popoverPos && (
          <EdgeTypePopover
            popoverPos={popoverPos}
            onSelectType={onBatchUpdateEdgeType}
          />
        )}

      {/* Multi-Select Kind Popover (shapes / state types) */}
      {activeMultiPopover === 'shape' &&
        driver.capabilities.supportsNodeKinds &&
        popoverPos && (
          <KindPopover
            popoverPos={popoverPos}
            options={driver.nodeKindOptions}
            title={`${driver.labels.node} Kind`}
            selectedNodeId={null}
            selectedNodeIds={selectedNodeIds}
            viewNodes={viewNodes}
            onSelectKind={onBatchSelectNodeKind}
          />
        )}

      {/* Multi-Select Visual Styling Popover */}
      {activeMultiPopover === 'style' && popoverPos && (
        <NodeStylePopover
          popoverPos={popoverPos}
          currentStyle={undefined}
          onApplyPreset={onApplyPreset}
          onUpdateCustomStyle={onUpdateCustomStyle}
          onClearStyle={onClearStyle}
          onSetDefaultStyle={onSetDefaultStyle}
          onClearDefaultStyle={onClearDefaultStyle}
          hasDefaultStyle={hasDefaultStyle}
        />
      )}
    </>
  );
};

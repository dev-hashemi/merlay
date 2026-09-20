/**
 * Canvas Overlays Manager
 * Composes dedicated overlay layers: Connection, MultiSelect, Node, Edge, Subgraph, and Inline Editing.
 * All layers consume the driver contract — no diagram-type branching here.
 */

import React from 'react';
import { CursorMode, SelectionBox } from '../types';
import { useCanvasSelection } from '../hooks/useCanvasSelection';
import { useDiagramMutations } from '../hooks/useDiagramMutations';
import { useInlineEditing } from '../hooks/useInlineEditing';
import { useCanvasMouseInteractions } from '../hooks/useCanvasMouseInteractions';

import { ConnectionLine } from './ConnectionLine';
import { SelectionMarquee } from './SelectionMarquee';
import { ConnectionHintPill } from './ConnectionHintPill';
import { NodeOverlays } from '../overlays/NodeOverlays';
import { EdgeOverlays } from '../overlays/EdgeOverlays';
import { SubgraphOverlays } from '../overlays/SubgraphOverlays';
import { MultiSelectOverlays } from '../overlays/MultiSelectOverlays';
import { InlineEditOverlays } from '../overlays/InlineEditOverlays';

import {
  useOverlayDerivedState,
  findNodeEditElement,
  findSubgraphEditElement,
} from './useOverlayDerivedState';

export interface CanvasOverlaysProps {
  mouse: ReturnType<typeof useCanvasMouseInteractions>;
  marquee: { selectionBox: SelectionBox | null };
  selection: ReturnType<typeof useCanvasSelection>;
  mutations: ReturnType<typeof useDiagramMutations>;
  inlineEditing: ReturnType<typeof useInlineEditing>;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  canRenameSelectedNode?: boolean;
  svgMountRef: React.RefObject<HTMLDivElement>;
  handleStartEditingNode: (nodeId: string, nodeEl: Element, event?: MouseEvent | TouchEvent) => void;
  onAddNodeAttribute?: (nodeId: string) => void;
  onAddNodeMethod?: (nodeId: string) => void;
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
  mouse,
  marquee,
  selection,
  mutations,
  inlineEditing,
  cursorMode,
  isSpacePressed,
  canRenameSelectedNode,
  svgMountRef,
  handleStartEditingNode,
  onAddNodeAttribute,
  onAddNodeMethod,
}) => {
  const { selectedNodeId, selectedEdgeId, selectedSubgraphId } = selection;
  const driver = mutations.driver;
  const {
    selectedStarKind,
    canUngroup,
    selectedNodeStyle,
    selectedEdgeStyle,
    selectedSubgraphStyle,
    selectedNodeLink,
    nodeMemberCapabilities,
    canAddStart,
    canAddEnd,
  } = useOverlayDerivedState(selection, mutations);

  return (
    <div className="mermaid-native-overlay">
      {/* Connection Dragging SVG Line (red when the driver refuses the drop) */}
      <ConnectionLine dragLine={mouse.dragLine} blocked={mouse.connectBlocked} />

      {/* Marquee Drag Selection Box */}
      <SelectionMarquee box={marquee.selectionBox} />

      {/* Node Drag-to-Connect Hint Pill */}
      <ConnectionHintPill
        hoveredNodeRect={mouse.hoveredNodeRect}
        hoveredNodeId={mouse.hoveredNodeId}
        hoveredNodeKind={mouse.hoveredNodeKind}
        selectedNodeRect={selection.selectedNodeRect}
        selectedNodeId={selectedNodeId}
        selectedNodeKind={selectedNodeId ? selectedStarKind : null}
        isLR={selection.isLR}
        cursorMode={cursorMode}
        isSpacePressed={isSpacePressed}
        isConnecting={!!mouse.connectingSourceId}
        isEditing={!!inlineEditing.editingNodeId}
        isMultiSelect={selection.isMultiSelect}
        // Arrow closure keeps `isAnchor` bound regardless of how the
        // checker resolves the detached method reference.
        isAnchor={
          driver.mutations.anchors
            ? (id: string) => driver.mutations.anchors?.isAnchor(id) ?? false
            : undefined
        }
      />

      {/* Multi-Select Layer */}
      <MultiSelectOverlays
        multiSelectBounds={selection.multiSelectBounds}
        isMultiSelect={selection.isMultiSelect}
        driver={driver}
        selectedNodeIds={selection.selectedNodeIds}
        selectedEdgeIds={selection.selectedEdgeIds}
        activeMultiPopover={selection.activeMultiPopover}
        onToggleMultiPopover={(popover) =>
          selection.setActiveMultiPopover((prev) => (prev === popover ? null : popover))
        }
        onBatchDelete={mutations.handleBatchDeleteSelected}
        onBatchGroup={mutations.handleBatchGroupSelected}
        canUngroup={canUngroup}
        onBatchUngroup={mutations.handleBatchUngroupSelected}
        popoverPos={selection.popoverPos}
        onBatchUpdateEdgeType={mutations.handleBatchUpdateEdgeType}
        viewNodes={mutations.displayNodes}
        onBatchSelectNodeKind={mutations.handleBatchUpdateNodeKind}
        onApplyPreset={mutations.handleBatchApplyThemePreset}
        onUpdateCustomStyle={mutations.handleBatchUpdateCustomStyle}
        onClearStyle={mutations.handleBatchClearStyle}
        onSetDefaultStyle={mutations.handleSetDefaultNodeStyle}
        onClearDefaultStyle={mutations.handleClearDefaultNodeStyle}
        hasDefaultStyle={mutations.hasDefaultNodeStyle}
      />

      {/* Single Node Layer */}
      <NodeOverlays
        selectedNodeRect={selection.selectedNodeRect}
        selectedNodeId={selectedNodeId}
        isMultiSelect={selection.isMultiSelect}
        sproutX={selection.sproutX}
        sproutY={selection.sproutY}
        isLR={selection.isLR}
        driver={driver}
        viewNodes={mutations.displayNodes}
        currentNode={selectedNodeId ? mutations.displayNodes.get(selectedNodeId) : undefined}
        currentStyle={selectedNodeStyle}
        activeNodePopover={selection.activeNodePopover}
        onSproutNextStep={mutations.handleSproutNextStep}
        onStartEditingNode={(nodeId) => {
          const el = findNodeEditElement(svgMountRef.current, nodeId);
          if (el) handleStartEditingNode(nodeId, el);
        }}
        onToggleNodePopover={(popover) =>
          selection.setActiveNodePopover((prev) => (prev === popover ? null : popover))
        }
        onDeleteNode={mutations.handleDeleteSelectedNode}
        onDuplicateNode={mutations.handleDuplicateSelected}
        canRenameNode={canRenameSelectedNode}
        nodeLinkUrl={selectedNodeLink}
        onOpenNodeLink={
          selectedNodeLink
            ? () => window.open(selectedNodeLink, '_blank', 'noopener')
            : undefined
        }
        popoverPos={selection.popoverPos}
        onSelectNodeKind={mutations.handleUpdateNodeKind}
        onApplyNodePreset={mutations.handleApplyNodePreset}
        onUpdateCustomStyle={mutations.handleUpdateCustomStyle}
        onClearNodeStyle={mutations.handleClearNodeStyle}
        onSetDefaultStyle={mutations.handleSetDefaultNodeStyle}
        onClearDefaultStyle={mutations.handleClearDefaultNodeStyle}
        hasDefaultStyle={mutations.hasDefaultNodeStyle}
        nodeMemberCapabilities={nodeMemberCapabilities}
        onAddNodeAttribute={onAddNodeAttribute}
        onAddNodeMethod={onAddNodeMethod}
        currentSubgraphId={
          selectedNodeId ? mutations.displayNodes.get(selectedNodeId)?.subgraphId : undefined
        }
        displaySubgraphs={mutations.displaySubgraphs}
        onSelectSubgraphMembership={(subId) => {
          if (selectedNodeId) mutations.handleMoveNodeToSubgraph(selectedNodeId, subId);
          selection.setActiveNodePopover(null);
        }}
        onCreateNewGroupMembership={() => {
          if (selectedNodeId) mutations.handleCreateGroupWithNode(selectedNodeId);
          selection.setActiveNodePopover(null);
        }}
        onRemoveNodeFromGroup={mutations.handleRemoveNodeFromGroup}
        onCloseSubgraphMembership={() => selection.setActiveNodePopover(null)}
      />

      {/* Single Edge Layer */}
      <EdgeOverlays
        selectedEdgePos={selection.selectedEdgePos}
        selectedEdgeId={selectedEdgeId}
        isMultiSelect={selection.isMultiSelect}
        driver={driver}
        selectedEdgeStyle={selectedEdgeStyle}
        activeEdgePopover={selection.activeEdgePopover}
        onChangeEdgeType={mutations.handleChangeEdgeType}
        onReverseEdge={mutations.handleReverseEdge}
        onInsertNodeOnEdge={mutations.handleInsertNodeOnEdge}
        onUpdateEdgeLabel={mutations.handleUpdateEdgeLabel}
        onToggleEdgeStyle={() =>
          selection.setActiveEdgePopover((prev) => (prev === 'style' ? null : 'style'))
        }
        onDeleteEdge={mutations.handleDeleteSelectedEdge}
        onApplyEdgePreset={mutations.handleApplyEdgePreset}
        onUpdateEdgeCustomStyle={mutations.handleUpdateEdgeCustomStyle}
        onClearEdgeStyle={mutations.handleClearEdgeStyle}
        onSetDefaultStyle={mutations.handleSetDefaultEdgeStyle}
        onClearDefaultStyle={mutations.handleClearDefaultEdgeStyle}
        hasDefaultStyle={mutations.hasDefaultEdgeStyle}
      />

      {/* Subgraph Layer */}
      <SubgraphOverlays
        selectedSubgraphRect={selection.selectedSubgraphRect}
        selectedSubgraphId={selectedSubgraphId}
        isMultiSelect={selection.isMultiSelect}
        displaySubgraphs={mutations.displaySubgraphs}
        selectedSubgraphStyle={selectedSubgraphStyle}
        activeSubgraphPopover={selection.activeSubgraphPopover}
        onToggleSubgraphStyle={() =>
          selection.setActiveSubgraphPopover((prev) => (prev === 'style' ? null : 'style'))
        }
        onToggleSubgraphGroup={() =>
          selection.setActiveSubgraphPopover((prev) => (prev === 'group' ? null : 'group'))
        }
        onStartEditingSubgraph={(subId) => {
          const subEl =
            findSubgraphEditElement(svgMountRef.current, subId) ??
            (selection.selectedSubgraphRect ? svgMountRef.current : null);
          if (subEl) inlineEditing.startEditingSubgraph(subId, subEl);
        }}
        onDissolveSubgraph={mutations.handleDissolveSubgraph}
        onDeleteSubgraphAll={mutations.handleDeleteSubgraphAll}
        subgraphPopoverPos={selection.subgraphPopoverPos}
        onApplySubgraphPreset={mutations.handleApplySubgraphPreset}
        onUpdateSubgraphCustomStyle={mutations.handleUpdateSubgraphCustomStyle}
        onClearSubgraphStyle={mutations.handleClearSubgraphStyle}
        unmatchedSubgraphIds={selection.unmatchedSubgraphIds}
        onSelectUnmatchedSubgraph={(subId, idx) => {
          selection.isolateSelection('subgraph', subId);
          selection.setSelectedSubgraphRect({
            x: 24,
            y: 52 + idx * 4,
            width: 200,
            height: 30,
          });
        }}
        onMoveSubgraphToGroup={(subId, targetId) => {
          mutations.handleMoveNodeToSubgraph(subId, targetId);
          selection.setActiveSubgraphPopover(null);
        }}
        onCreateParentGroupWithSubgraph={(subId) => {
          mutations.handleCreateGroupWithNode(subId);
          selection.setActiveSubgraphPopover(null);
        }}
        onCloseSubgraphPopover={() => selection.setActiveSubgraphPopover(null)}
        canAddStart={canAddStart}
        canAddEnd={canAddEnd}
        onAddStart={
          selectedSubgraphId && driver.capabilities.hasAnchors
            ? () => mutations.handleAddStartState(selectedSubgraphId)
            : undefined
        }
        onAddEnd={
          selectedSubgraphId && driver.capabilities.hasAnchors
            ? () => mutations.handleAddEndState(selectedSubgraphId)
            : undefined
        }
      />

      {/* Inline Text Editors Layer */}
      <InlineEditOverlays
        editingNodeId={inlineEditing.editingNodeId}
        editingPos={inlineEditing.editingPos}
        editNodeLabel={inlineEditing.editNodeLabel}
        onEditNodeLabelChange={inlineEditing.setEditNodeLabel}
        onFinishEditingNode={inlineEditing.handleFinishEditingNode}
        onCancelEditingNode={inlineEditing.cancelEditingNode}
        editingMemberSection={inlineEditing.editingMemberSection}
        onEditMemberSectionTextChange={inlineEditing.setEditMemberSectionText}
        onFinishEditingMemberSection={inlineEditing.handleFinishEditingMemberSection}
        onCancelEditingMemberSection={inlineEditing.cancelEditingMemberSection}
        editingEdgeId={inlineEditing.editingEdgeId}
        editingEdgePos={inlineEditing.editingEdgePos}
        editEdgeLabel={inlineEditing.editEdgeLabel}
        onEditEdgeLabelChange={inlineEditing.setEditEdgeLabel}
        onFinishEditingEdge={inlineEditing.handleFinishEditingEdge}
        onCancelEditingEdge={inlineEditing.cancelEditingEdge}
        editingSubgraphId={inlineEditing.editingSubgraphId}
        editingSubgraphPos={inlineEditing.editingSubgraphPos}
        editSubgraphLabel={inlineEditing.editSubgraphLabel}
        onEditSubgraphLabelChange={inlineEditing.setEditSubgraphLabel}
        onFinishEditingSubgraph={inlineEditing.handleFinishEditingSubgraph}
        onCancelEditingSubgraph={inlineEditing.cancelEditingSubgraph}
      />
    </div>
  );
};

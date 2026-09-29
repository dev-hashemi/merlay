/**
 * Overlays for Selected Nodes: HUD, Kind Popover, Node Style Popover, Group Membership.
 */

import React, { useState } from 'react';
import { ActiveNodePopover, PopoverPos, Rect } from '../types';
import { ThemePreset } from '../constants';
import { MermaidNodeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { DiagramDriver, NodeMemberCapabilities } from '../../diagrams/types';
import { NodeLinkDetails } from '../../diagrams/nodeLinks';
import { DiagramNoteDetails } from '../../diagrams/common';
import { NodeActionHud } from '../components/NodeActionHud';
import { KindPopover } from '../components/KindPopover';
import { NodeStylePopover } from '../components/NodeStylePopover';
import { SubgraphPopover } from '../components/SubgraphPopover';
import { LinkPopover } from '../components/LinkPopover';
import { NotePopover } from '../components/NotePopover';
import { ShapeDataPopover } from '../components/ShapeDataPopover';

export interface NodeOverlaysProps {
  selectedNodeRect: Rect | null;
  selectedNodeId: string | null;
  isMultiSelect: boolean;
  sproutX: number;
  sproutY: number;
  isLR: boolean;
  driver: DiagramDriver;
  viewNodes: Map<string, MermaidNodeDef>;
  currentNode: MermaidNodeDef | undefined;
  currentStyle: Record<string, string> | undefined;
  activeNodePopover: ActiveNodePopover;
  onSproutNextStep: (nodeId: string) => void;
  onStartEditingNode: (nodeId: string) => void;
  onToggleNodePopover: (
    popover: 'shape' | 'style' | 'subgraph' | 'link' | 'note' | 'shapedata'
  ) => void;
  onDeleteNode: () => void;
  onDuplicateNode?: () => void;
  canRenameNode?: boolean;
  nodeLinkUrl?: string;
  nodeLinkDetails?: NodeLinkDetails;
  onSetNodeLink?: (nodeId: string, details: NodeLinkDetails | null) => void;
  onOpenNodeLink?: () => void;
  nodeNotes?: DiagramNoteDetails[];
  onSetNodeNote?: (targetId: string, note: DiagramNoteDetails | null) => void;
  onSetNodeShapeParam?: (nodeId: string, key: string, value: string | null) => void;

  popoverPos: PopoverPos | null;
  onSelectNodeKind: (kind: string) => void;
  onApplyNodePreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (prop: string, val: string) => void;
  onClearNodeStyle: () => void;
  onSetDefaultStyle?: () => void;
  onClearDefaultStyle?: () => void;
  hasDefaultStyle?: boolean;
  classDefs?: Array<{ name: string; styles: Record<string, string> }>;
  nodeClasses?: string[];
  onToggleNodeClass?: (className: string) => void;
  onSaveClassDef?: (name: string, styles: Record<string, string>) => void;
  onDeleteClassDef?: (name: string) => void;

  onAddNodeAttribute?: (nodeId: string) => void;
  onAddNodeMethod?: (nodeId: string) => void;
  nodeMemberCapabilities?: NodeMemberCapabilities;

  currentSubgraphId: string | undefined;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  onSelectSubgraphMembership: (subId: string | null) => void;
  onCreateNewGroupMembership: () => void;
  onRemoveNodeFromGroup?: (nodeId: string) => void;
  onCloseSubgraphMembership: () => void;
}

export const NodeOverlays: React.FC<NodeOverlaysProps> = ({
  selectedNodeRect,
  selectedNodeId,
  isMultiSelect,
  sproutX,
  sproutY,
  isLR,
  driver,
  viewNodes,
  currentNode,
  currentStyle,
  activeNodePopover,
  onSproutNextStep,
  onStartEditingNode,
  onToggleNodePopover,
  onDeleteNode,
  onDuplicateNode,
  canRenameNode,
  nodeLinkUrl,
  nodeLinkDetails,
  onSetNodeLink,
  onOpenNodeLink,
  nodeNotes,
  onSetNodeNote,
  onSetNodeShapeParam,
  popoverPos,
  onSelectNodeKind,
  onApplyNodePreset,
  onUpdateCustomStyle,
  onClearNodeStyle,
  onSetDefaultStyle,
  onClearDefaultStyle,
  hasDefaultStyle,
  classDefs,
  nodeClasses,
  onToggleNodeClass,
  onSaveClassDef,
  onDeleteClassDef,
  onAddNodeAttribute,
  onAddNodeMethod,
  nodeMemberCapabilities,
  currentSubgraphId,
  displaySubgraphs,
  onSelectSubgraphMembership,
  onCreateNewGroupMembership,
  onRemoveNodeFromGroup,
  onCloseSubgraphMembership,
}) => {
  // Editable shape-data field for special shapes (image URL, icon name).
  // Gated on the driver offering the mutation; the key map is view-model
  // data (shape value), never a diagram-type branch.
  const shapeDataCapable = !!driver.mutations.setNodeShapeParam;
  // The projection is one render behind a just-picked kind, so remember it
  // until the popover closes (also drives auto-open after picking).
  const [pendingShapeKind, setPendingShapeKind] = useState<string | null>(null);
  const shapeKindForData = pendingShapeKind ?? currentNode?.shape;
  const shapeDataValue =
    currentNode?.shape === shapeKindForData ? (currentNode?.shapeParams ?? {}) : {};
  const shapeDataField: {
    key: string;
    label: string;
    placeholder: string;
    value: string;
    hint?: string;
    suggestions?: string[];
  } | null =
    selectedNodeId && shapeDataCapable
      ? shapeKindForData === 'image'
        ? {
            key: 'img',
            label: 'Image URL',
            placeholder: 'https://...',
            value: (shapeDataValue as Record<string, string>).img ?? '',
          }
        : shapeKindForData === 'icon'
          ? {
              key: 'icon',
              label: 'Icon name',
              placeholder: 'fa:user',
              value: (shapeDataValue as Record<string, string>).icon ?? '',
              hint: 'Font Awesome names (fa:user, fa:star…). The glyph renders only when the host app registered icon packs; the label always shows.',
              suggestions: [
                'fa:user', 'fa:users', 'fa:home', 'fa:star', 'fa:heart',
                'fa:check', 'fa:xmark', 'fa:bell', 'fa:cog', 'fa:calendar',
                'fa:file', 'fa:folder', 'fa:image', 'fa:music', 'fa:car',
                'fa:circle', 'fa:flag', 'fa:lock', 'fa:magnifying-glass',
              ],
            }
          : null
      : null;

  const closeShapeData = () => {
    setPendingShapeKind(null);
    onToggleNodePopover('shapedata');
  };

  return (
    <>
      {/* Single Node Relational Sprout HUD */}
      {selectedNodeRect && selectedNodeId && !isMultiSelect && (
        <NodeActionHud
          selectedNodeId={selectedNodeId}
          sproutX={sproutX}
          sproutY={sproutY}
          isLR={isLR}
          driver={driver}
          currentNode={currentNode}
          currentStyle={currentStyle}
          activeNodePopover={activeNodePopover}
          onSproutNextStep={() => onSproutNextStep(selectedNodeId)}
          onRename={() => onStartEditingNode(selectedNodeId)}
          onTogglePopover={onToggleNodePopover}
          onRemoveFromGroup={
            onRemoveNodeFromGroup
              ? () => onRemoveNodeFromGroup(selectedNodeId)
              : undefined
          }
          onDelete={onDeleteNode}
          onDuplicate={onDuplicateNode}
          canRename={canRenameNode}
          nodeLinkUrl={nodeLinkUrl}
          onOpenNodeLink={onOpenNodeLink}
          hasNote={Boolean(nodeNotes && nodeNotes.length > 0)}
          shapeDataField={shapeDataField}
          onAddAttribute={
            onAddNodeAttribute ? () => onAddNodeAttribute(selectedNodeId) : undefined
          }
          onAddMethod={
            onAddNodeMethod ? () => onAddNodeMethod(selectedNodeId) : undefined
          }
          supportsAttributes={nodeMemberCapabilities?.supportsAttributes ?? true}
          supportsMethods={nodeMemberCapabilities?.supportsMethods ?? true}
          attributeLabel={nodeMemberCapabilities?.attributeLabel}
          methodLabel={nodeMemberCapabilities?.methodLabel}
          hideSprout={
            !!driver.mutations.anchors?.isAnchor(selectedNodeId)
          }
          hideDelete={false}
        />
      )}

      {/* Kind Popover (shapes / state types) */}
      {activeNodePopover === 'shape' &&
        driver.capabilities.supportsNodeKinds &&
        popoverPos && (
          <KindPopover
            popoverPos={popoverPos}
            options={driver.nodeKindOptions}
            title={`${driver.labels.node} Kind`}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={new Set(selectedNodeId ? [selectedNodeId] : [])}
            viewNodes={viewNodes}
            onSelectKind={(kind) => {
              onSelectNodeKind(kind);
              // Image/icon nodes need their data (URL, icon name) to render
              // anything useful — open its editor right away so picking the
              // shape flows straight into providing it.
              if ((kind === 'image' || kind === 'icon') && shapeDataCapable) {
                setPendingShapeKind(kind);
                onToggleNodePopover('shapedata');
              }
            }}
            onClose={() => onToggleNodePopover('shape')}
          />
        )}

      {/* Visual Styling Popover for single node */}
      {activeNodePopover === 'style' &&
        driver.capabilities.supportsNodeStyles !== false &&
        popoverPos && (
        <NodeStylePopover
          popoverPos={popoverPos}
          currentStyle={currentStyle}
          onApplyPreset={onApplyNodePreset}
          onUpdateCustomStyle={onUpdateCustomStyle}
          onClearStyle={onClearNodeStyle}
          onSetDefaultStyle={onSetDefaultStyle}
          onClearDefaultStyle={onClearDefaultStyle}
          hasDefaultStyle={hasDefaultStyle}
          classDefs={classDefs}
          nodeClasses={nodeClasses}
          onToggleNodeClass={onToggleNodeClass}
          onSaveClassDef={onSaveClassDef}
          onDeleteClassDef={onDeleteClassDef}
        />
      )}

      {/* Group Membership Popover */}
      {activeNodePopover === 'subgraph' && popoverPos && selectedNodeId && (
        <div
          style={{
            position: 'absolute',
            left: popoverPos.left,
            top: popoverPos.top,
            transform: popoverPos.transform,
            zIndex: 200,
          }}
        >
          <SubgraphPopover
            currentSubgraphId={currentSubgraphId}
            subgraphs={Array.from(displaySubgraphs.values())}
            onSelectSubgraph={onSelectSubgraphMembership}
            onCreateNewGroup={onCreateNewGroupMembership}
            onClose={onCloseSubgraphMembership}
          />
        </div>
      )}

      {/* Hyperlink Popover */}
      {activeNodePopover === 'link' &&
        driver.capabilities.supportsNodeLinks &&
        popoverPos &&
        selectedNodeId && (
          <LinkPopover
            popoverPos={popoverPos}
            initialDetails={nodeLinkDetails}
            onApply={(details) => onSetNodeLink?.(selectedNodeId, details)}
            onRemove={() => onSetNodeLink?.(selectedNodeId, null)}
            onClose={() => onToggleNodePopover('link')}
            onOpenLink={
              onOpenNodeLink
                ? () => onOpenNodeLink()
                : (url) => window.open(url, '_blank', 'noopener')
            }
          />
        )}

      {/* Note Popover */}
      {activeNodePopover === 'note' &&
        driver.capabilities.supportsNotes &&
        popoverPos &&
        selectedNodeId && (
          <NotePopover
            popoverPos={popoverPos}
            initialNote={nodeNotes && nodeNotes.length > 0 ? nodeNotes[0] : undefined}
            notePositions={driver.capabilities.notePositions}
            targetLabel={currentNode?.label || selectedNodeId}
            onApply={(note) => onSetNodeNote?.(selectedNodeId, note)}
            onRemove={() => onSetNodeNote?.(selectedNodeId, null)}
            onClose={() => onToggleNodePopover('note')}
          />
        )}

      {/* Shape Data Popover (image URL, icon name) */}
      {activeNodePopover === 'shapedata' &&
        shapeDataField &&
        popoverPos &&
        selectedNodeId && (
          <ShapeDataPopover
            popoverPos={popoverPos}
            fieldLabel={shapeDataField.label}
            placeholder={shapeDataField.placeholder}
            initialValue={shapeDataField.value}
            suggestions={shapeDataField.suggestions}
            hint={shapeDataField.hint}
            onApply={(value) =>
              onSetNodeShapeParam?.(selectedNodeId, shapeDataField.key, value)
            }
            onClear={() => onSetNodeShapeParam?.(selectedNodeId, shapeDataField.key, null)}
            onClose={closeShapeData}
          />
        )}
    </>
  );
};

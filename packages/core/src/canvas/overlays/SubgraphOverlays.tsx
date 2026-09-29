/**
 * Overlays for Selected Subgraphs: Subgraph Action HUD, Style Popover, and Fallback Chips Bar.
 */

import React, { useMemo } from 'react';
import { PopoverPos, Rect } from '../types';
import { ThemePreset } from '../constants';
import { MermaidSubgraphDef, MermaidEdgeDef } from '../../diagrams/viewModel';
import { SubgraphActionHud } from '../components/SubgraphActionHud';
import { NodeStylePopover } from '../components/NodeStylePopover';
import { SubgraphPopover } from '../components/SubgraphPopover';

export interface SubgraphOverlaysProps {
  selectedSubgraphRect: Rect | null;
  selectedSubgraphId: string | null;
  isMultiSelect: boolean;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  displayEdges?: MermaidEdgeDef[];
  diagramDirection?: string;
  selectedSubgraphStyle: Record<string, string> | undefined;
  activeSubgraphPopover: 'style' | 'group' | null;
  onToggleSubgraphStyle: () => void;
  onToggleSubgraphGroup?: () => void;
  onStartEditingSubgraph: (subId: string) => void;
  onDissolveSubgraph: () => void;
  onDeleteSubgraphAll: () => void;
  subgraphPopoverPos: PopoverPos | null;
  onApplySubgraphPreset: (preset: ThemePreset) => void;
  onUpdateSubgraphCustomStyle: (prop: string, val: string) => void;
  onClearSubgraphStyle: () => void;
  unmatchedSubgraphIds: string[];
  onSelectUnmatchedSubgraph: (subId: string, idx: number) => void;
  onMoveSubgraphToGroup?: (subId: string, targetParentId: string | null) => void;
  onCreateParentGroupWithSubgraph?: (subId: string) => void;
  onCloseSubgraphPopover?: () => void;
  canAddStart?: boolean;
  canAddEnd?: boolean;
  onAddStart?: () => void;
  onAddEnd?: () => void;
  onToggleSubgraphDirection?: () => void;
  onSprout?: (subId: string) => void;
  sproutLabel?: string;
  canAddConcurrencyDivider?: boolean;
  onAddConcurrencyDivider?: (subId: string) => void;
  dividerCount?: number;
  onRemoveConcurrencyDivider?: (subId: string) => void;
}

/**
 * Checks whether an overridden subgraph direction will be flattened by Mermaid's Dagre layout.
 * Dagre forces global rank alignment when inner nodes connect directly across the subgraph
 * boundary instead of connecting to/from the subgraph cluster boundary itself.
 */
export function hasSubgraphDirectionConflict(
  subgraph: MermaidSubgraphDef | undefined,
  diagramDirection: string | undefined,
  displaySubgraphs: Map<string, MermaidSubgraphDef>,
  displayEdges: MermaidEdgeDef[] | undefined
): boolean {
  if (!subgraph?.direction || !displayEdges) return false;

  const normDiagram = (diagramDirection || 'TD').toUpperCase();
  const isDiagramHorizontal = normDiagram === 'LR' || normDiagram === 'RL';

  const normSub = subgraph.direction.toUpperCase();
  const isSubHorizontal = normSub === 'LR' || normSub === 'RL';

  if (isSubHorizontal === isDiagramHorizontal) return false;

  // Gather all member node IDs in this subgraph (including nested child subgraphs)
  const memberNodeIds = new Set<string>(subgraph.nodeIds);
  const queue = [...(subgraph.subgraphIds || [])];
  while (queue.length > 0) {
    const childId = queue.shift()!;
    const childSub = displaySubgraphs.get(childId);
    if (childSub) {
      for (const nid of childSub.nodeIds) {
        memberNodeIds.add(nid);
      }
      if (childSub.subgraphIds) {
        queue.push(...childSub.subgraphIds);
      }
    }
  }

  if (memberNodeIds.size === 0) return false;

  // Check if any member node connects directly across boundaries to an external node
  for (const edge of displayEdges) {
    const isFromMember = memberNodeIds.has(edge.from);
    const isToMember = memberNodeIds.has(edge.to);

    if (isFromMember && !isToMember && edge.to !== subgraph.id) {
      return true;
    }
    if (isToMember && !isFromMember && edge.from !== subgraph.id) {
      return true;
    }
  }

  return false;
}

export const SubgraphOverlays: React.FC<SubgraphOverlaysProps> = ({
  selectedSubgraphRect,
  selectedSubgraphId,
  isMultiSelect,
  displaySubgraphs,
  displayEdges,
  diagramDirection,
  selectedSubgraphStyle,
  activeSubgraphPopover,
  onToggleSubgraphStyle,
  onToggleSubgraphGroup,
  onStartEditingSubgraph,
  onDissolveSubgraph,
  onDeleteSubgraphAll,
  subgraphPopoverPos,
  onApplySubgraphPreset,
  onUpdateSubgraphCustomStyle,
  onClearSubgraphStyle,
  unmatchedSubgraphIds,
  onSelectUnmatchedSubgraph,
  onMoveSubgraphToGroup,
  onCreateParentGroupWithSubgraph,
  onCloseSubgraphPopover,
  canAddStart,
  canAddEnd,
  onAddStart,
  onAddEnd,
  onToggleSubgraphDirection,
  onSprout,
  sproutLabel,
  canAddConcurrencyDivider,
  onAddConcurrencyDivider,
  dividerCount,
  onRemoveConcurrencyDivider,
}) => {
  const hasDirectionConflict = useMemo(() => {
    if (!selectedSubgraphId) return false;
    const sub = displaySubgraphs.get(selectedSubgraphId);
    return hasSubgraphDirectionConflict(sub, diagramDirection, displaySubgraphs, displayEdges);
  }, [selectedSubgraphId, displaySubgraphs, diagramDirection, displayEdges]);

  const currentParentSubgraphId = useMemo(() => {
    if (!selectedSubgraphId) return undefined;
    for (const [id, sub] of displaySubgraphs.entries()) {
      if (sub.subgraphIds?.includes(selectedSubgraphId)) return id;
    }
    return undefined;
  }, [selectedSubgraphId, displaySubgraphs]);

  const availableParentSubgraphs = useMemo(() => {
    if (!selectedSubgraphId) return [];
    // Collect all descendant IDs to avoid circular nesting
    const descendants = new Set<string>();
    const queue = [selectedSubgraphId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const def = displaySubgraphs.get(curr);
      if (def?.subgraphIds) {
        for (const cid of def.subgraphIds) {
          if (!descendants.has(cid)) {
            descendants.add(cid);
            queue.push(cid);
          }
        }
      }
    }
    return Array.from(displaySubgraphs.values()).filter(
      (sub) => sub.id !== selectedSubgraphId && !descendants.has(sub.id)
    );
  }, [selectedSubgraphId, displaySubgraphs]);

  return (
    <>
      {/* Subgraph Floating Action HUD */}
      {selectedSubgraphRect &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <SubgraphActionHud
            subgraph={displaySubgraphs.get(selectedSubgraphId)!}
            centerX={selectedSubgraphRect.x + selectedSubgraphRect.width / 2}
            topY={selectedSubgraphRect.y}
            currentStyle={selectedSubgraphStyle}
            isStyleActive={activeSubgraphPopover === 'style'}
            isGroupActive={activeSubgraphPopover === 'group'}
            onToggleStyle={onToggleSubgraphStyle}
            onToggleGroup={onToggleSubgraphGroup}
            onRename={() => onStartEditingSubgraph(selectedSubgraphId)}
            onDissolve={onDissolveSubgraph}
            onDeleteAll={onDeleteSubgraphAll}
            canAddStart={canAddStart}
            canAddEnd={canAddEnd}
            onAddStart={onAddStart}
            onAddEnd={onAddEnd}
            onToggleDirection={onToggleSubgraphDirection}
            hasDirectionConflict={hasDirectionConflict}
            onSprout={onSprout && selectedSubgraphId ? () => onSprout(selectedSubgraphId) : undefined}
            sproutLabel={sproutLabel}
            canAddConcurrencyDivider={canAddConcurrencyDivider}
            onAddConcurrencyDivider={
              onAddConcurrencyDivider ? () => onAddConcurrencyDivider(selectedSubgraphId) : undefined
            }
            dividerCount={dividerCount}
            onRemoveConcurrencyDivider={
              onRemoveConcurrencyDivider ? () => onRemoveConcurrencyDivider(selectedSubgraphId) : undefined
            }
          />
        )}

      {/* Subgraph Style Popover */}
      {activeSubgraphPopover === 'style' &&
        subgraphPopoverPos &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <NodeStylePopover
            popoverPos={subgraphPopoverPos}
            currentStyle={selectedSubgraphStyle}
            defaultDash="dashed"
            onApplyPreset={onApplySubgraphPreset}
            onUpdateCustomStyle={onUpdateSubgraphCustomStyle}
            onClearStyle={onClearSubgraphStyle}
          />
        )}

      {/* Subgraph Group Membership Popover (Nesting into another composite/group) */}
      {activeSubgraphPopover === 'group' &&
        subgraphPopoverPos &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <div
            style={{
              position: 'absolute',
              left: subgraphPopoverPos.left,
              top: subgraphPopoverPos.top,
              transform: subgraphPopoverPos.transform,
              zIndex: 200,
            }}
          >
            <SubgraphPopover
              currentSubgraphId={currentParentSubgraphId}
              subgraphs={availableParentSubgraphs}
              onSelectSubgraph={(targetParentId) => {
                if (onMoveSubgraphToGroup) {
                  onMoveSubgraphToGroup(selectedSubgraphId, targetParentId);
                }
              }}
              onCreateNewGroup={() => {
                if (onCreateParentGroupWithSubgraph) {
                  onCreateParentGroupWithSubgraph(selectedSubgraphId);
                }
              }}
              onClose={() => {
                if (onCloseSubgraphPopover) onCloseSubgraphPopover();
              }}
            />
          </div>
        )}

      {/* Fallback chips for groups with no rendered cluster element */}
      {unmatchedSubgraphIds.length > 0 && (
        <div
          className="mermaid-group-fallback-bar nodrag"
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            display: 'flex',
            gap: 6,
            zIndex: 120,
            maxWidth: '70%',
            flexWrap: 'wrap',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {unmatchedSubgraphIds.map((subId, idx) => {
            const sub = displaySubgraphs.get(subId);
            if (!sub) return null;
            const isActive = selectedSubgraphId === subId;
            return (
              <button
                key={subId}
                type="button"
                className={`mermaid-subgraph-badge ${isActive ? 'is-selected' : ''}`}
                style={isActive ? { outline: '2px solid var(--mermaid-accent)' } : undefined}
                title={
                  sub.nodeIds.length === 0
                    ? `Empty group "${sub.label}" — click to select`
                    : `Group "${sub.label}" — click to select`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectUnmatchedSubgraph(subId, idx);
                }}
              >
                <span>{sub.label || subId}</span>
                {sub.nodeIds.length === 0 && <span> (empty)</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
